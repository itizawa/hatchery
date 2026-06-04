import {
  AddChannelMemberSchema,
  CreateChannelMessageSchema,
  CreateChannelSchema,
  UpdateChannelSchema,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { ChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import type { MessageRepository } from "../persistence/messageRepository.js";
import { addChannelMember, removeChannelMember } from "../usecases/channelMembers.js";

/**
 * /channels ルータ。チャンネル更新（#37）と Employee 所属管理（#33）、メッセージ投稿（#48）を担う。
 * 更新・追加 / 除外・投稿は認証必須（requireAuth）。一覧取得は認証不要。
 * 永続化は注入されたリポジトリに委ねる（層分離 / ADR-0004）。
 */
export function createChannelsRouter(
  membershipRepo: ChannelMembershipRepository,
  channelRepo: ChannelRepository,
  messageRepo: MessageRepository,
): Router {
  const router = Router();

  // チャンネル一覧（認証不要・#47）。状態確認・バッチ連携の素材として公開する。
  router.get("/", (_req, res, next) => {
    channelRepo
      .list()
      .then((channels) => res.status(200).json(channels))
      .catch(next);
  });

  // チャンネル作成（認証必須・#47・#54）。id はリポジトリが採番する。type 省略時は zatsudan。
  router.post("/", requireAuth, validateBody(CreateChannelSchema), (req, res, next) => {
    const { label, type } = req.body as CreateChannelInput;
    channelRepo
      .create({ label, type })
      .then((channel) => res.status(201).json(channel))
      .catch(next);
  });

  // チャンネル更新（認証必須・#54）。label / type の一方または両方を更新できる。
  router.patch("/:id", requireAuth, validateBody(UpdateChannelSchema), (req, res, next) => {
    const { id } = req.params as { id: string };
    const input = req.body as UpdateChannelInput;
    channelRepo
      .update(id, input)
      .then((channel) => {
        if (!channel) {
          res.status(404).json({ error: "ChannelNotFound" });
          return;
        }
        res.status(200).json(channel);
      })
      .catch(next);
  });

  // チャンネル別メッセージ一覧（認証不要・#48）。
  router.get("/:channelId/messages", (req, res, next) => {
    const { channelId } = req.params as { channelId: string };
    messageRepo
      .listByChannel(channelId)
      .then((messages) => res.status(200).json(messages))
      .catch(next);
  });

  // チャンネルへのメッセージ投稿（認証必須・#48）。speaker は req.user.employeeId を使う。
  router.post(
    "/:channelId/messages",
    requireAuth,
    validateBody(CreateChannelMessageSchema),
    (req, res, next) => {
      const { channelId } = req.params as { channelId: string };
      const user = req.user!;
      if (!user.employeeId) {
        res.status(400).json({ error: "EmployeeNotLinked" });
        return;
      }
      const { text } = req.body as { text: string };
      channelRepo
        .findById(channelId)
        .then((channel) => {
          if (!channel) {
            res.status(404).json({ error: "ChannelNotFound" });
            return;
          }
          return messageRepo
            .createMany([{ speaker: user.employeeId!, channel: channelId, text }])
            .then(([created]) => res.status(201).json(created));
        })
        .catch(next);
    },
  );

  router.get("/:channelId/employees", (req, res, next) => {
    membershipRepo
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
      addChannelMember(membershipRepo, channelId, employeeId)
        .then(() => res.status(201).json({ channelId, employeeId }))
        .catch(next);
    },
  );

  router.delete("/:channelId/employees/:employeeId", requireAuth, (req, res, next) => {
    const { channelId, employeeId } = req.params as { channelId: string; employeeId: string };
    removeChannelMember(membershipRepo, channelId, employeeId)
      .then(() => res.status(204).end())
      .catch(next);
  });

  return router;
}
