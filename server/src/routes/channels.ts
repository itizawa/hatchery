import { AddChannelMemberSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { ChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { addChannelMember, removeChannelMember } from "../usecases/channelMembers.js";

/**
 * /channels ルータ。チャンネルへの Employee 所属（多対多）を管理する（#33）。
 * 追加 / 除外は認証必須（requireAuth）。一覧取得は認証不要（状態確認・バッチ連携の素材）。
 * 永続化は注入された ChannelMembershipRepository に委ねる（層分離 / ADR-0004）。
 */
export function createChannelsRouter(repo: ChannelMembershipRepository): Router {
  const router = Router();

  router.get("/:channelId/employees", (req, res, next) => {
    repo
      .listEmployeeIdsByChannel(req.params.channelId)
      .then((ids) => res.status(200).json(ids))
      .catch(next);
  });

  router.post(
    "/:channelId/employees",
    requireAuth,
    validateBody(AddChannelMemberSchema),
    (req, res, next) => {
      const { channelId } = req.params as { channelId: string };
      const { employeeId } = req.body as { employeeId: string };
      addChannelMember(repo, channelId, employeeId)
        .then(() => res.status(201).json({ channelId, employeeId }))
        .catch(next);
    },
  );

  router.delete("/:channelId/employees/:employeeId", requireAuth, (req, res, next) => {
    const { channelId, employeeId } = req.params as { channelId: string; employeeId: string };
    removeChannelMember(repo, channelId, employeeId)
      .then(() => res.status(204).end())
      .catch(next);
  });

  return router;
}
