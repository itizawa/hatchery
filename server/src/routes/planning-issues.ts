import { err, internalError, isErr, notFound, ok } from "@hatchery/common";
import { Octokit } from "@octokit/rest";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import type { MessageRepository } from "../persistence/messageRepository.js";
import { resultToResponse } from "../utils/resultToResponse.js";

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
        resultToResponse(res, err(internalError("GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO が設定されていません")));
        return;
      }

      const channelMessages = await messageRepo.listByChannel(channelId);
      const message = channelMessages.find((m) => m.id === messageId);
      const messageResult = message ? ok(message) : err(notFound("MessageNotFound"));
      if (isErr(messageResult)) { resultToResponse(res, messageResult); return; }
      const foundMessage = messageResult.value;

      const title = foundMessage.proposalTitle
        ? `[UX提案] ${foundMessage.proposalTitle}`
        : `[UX提案] ${foundMessage.text}`;

      const body = [
        foundMessage.proposalReason ?? foundMessage.text,
        "",
        foundMessage.proposalTargetUrl ? `**対象画面**: ${foundMessage.proposalTargetUrl}` : null,
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
        });

        const updated = await messageRepo.updateIssueRef(messageId, data.number, data.html_url);
        if (!updated) {
          console.error(`[planning-issues] updateIssueRef failed for messageId=${messageId} after issuing #${data.number}`);
        }

        res.status(201).json({
          issueNumber: data.number,
          issueUrl: data.html_url,
        });
      } catch (e) {
        next(e);
      }
    },
  );

  return router;
}
