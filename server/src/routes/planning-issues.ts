import { Octokit } from "@octokit/rest";
import { Router } from "express";

import { InternalServerError, NotFoundError } from "@hatchery/common";

import { requireAuth } from "../middleware/requireAuth.js";
import type { MessageRepository } from "../persistence/messageRepository.js";

/**
 * GitHub Issue 起票ルータ（#76）。
 * POST /channels/:channelId/messages/:messageId/create-issue
 * 企画 チャンネルのメッセージから GitHub Issue を起票し、メッセージに参照を追記する。
 * 認証必須。GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO 環境変数が必要。
 */
export function createPlanningIssuesRouter(messageRepo: MessageRepository): Router {
  const router = Router({ mergeParams: true });

  router.post(
    "/:channelId/messages/:messageId/create-issue",
    requireAuth,
    async (req, res, next) => {
      const { channelId, messageId } = req.params as { channelId: string; messageId: string };

      const token = process.env.GITHUB_TOKEN;
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;

      if (!token || !owner || !repo) {
        next(new InternalServerError("GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO が設定されていません"));
        return;
      }

      const channelMessages = await messageRepo.listByChannel(channelId);
      const message = channelMessages.find((m) => m.id === messageId);
      if (!message) {
        next(new NotFoundError("MessageNotFound"));
        return;
      }

      const title = message.proposalTitle
        ? `[UX提案] ${message.proposalTitle}`
        : `[UX提案] ${message.text}`;

      const body = [
        message.proposalReason ?? message.text,
        "",
        message.proposalTargetUrl ? `**対象画面**: ${message.proposalTargetUrl}` : null,
        "",
        "_AI が 企画 チャンネルから自動起票_",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      try {
        const octokit = new Octokit({ auth: token });
        const { data } = await octokit.issues.create({
          owner,
          repo,
          title,
          body,
          labels: ["df:todo"],
        });

        const updated = await messageRepo.updateIssueRef(messageId, data.number, data.html_url);
        if (!updated) {
          console.error(`[planning-issues] updateIssueRef failed for messageId=${messageId} after issuing #${data.number}`);
        }

        res.status(201).json({
          issueNumber: data.number,
          issueUrl: data.html_url,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
