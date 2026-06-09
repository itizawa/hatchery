import {
  AddChannelMemberSchema,
  BadRequestError,
  CreateChannelMessageSchema,
  CreateChannelSchema,
  NotFoundError,
  UpdateChannelSchema,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@hatchery/common";
import { Router } from "express";

import type { ConversationGenerator } from "../batch/aiMessageGenerator.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { ChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import type { EmployeeRepository } from "../persistence/employeeRepository.js";
import type { MessageRepository } from "../persistence/messageRepository.js";
import { addChannelMember, removeChannelMember } from "../usecases/channelMembers.js";
import { generateAiResponsesForChannel } from "../usecases/generateAiResponsesForChannel.js";

/** AI 会話生成に必要な追加依存（#183）。未指定時は AI 生成をスキップ。 */
export interface AiGenerationDeps {
  employeeRepo: EmployeeRepository;
  appSettingRepo: AppSettingRepository;
  /** テスト用注入可能な会話生成関数。省略時は Claude を使う。 */
  generate?: ConversationGenerator;
}

/**
 * /channels ルータ。チャンネル更新（#37）と Employee 所属管理（#33）、メッセージ投稿（#48）を担う。
 * 更新・追加 / 除外・投稿は認証必須（requireAuth）。一覧取得は認証不要。
 * 永続化は注入されたリポジトリに委ねる（層分離 / ADR-0004）。
 * aiDeps を渡すとユーザー投稿後に非同期で AI 会話生成を行う（#183）。
 */
export function createChannelsRouter(
  membershipRepo: ChannelMembershipRepository,
  channelRepo: ChannelRepository,
  messageRepo: MessageRepository,
  aiDeps?: AiGenerationDeps,
): Router {
  const router = Router();

  // チャンネル一覧（認証不要・#47）。状態確認・バッチ連携の素材として公開する。
  router.get("/", (_req, res, next) => {
    channelRepo
      .list()
      .then((channels) => res.status(200).json(channels))
      .catch(next);
  });

  // チャンネル作成（認証必須・#47・#54）。id はリポジトリが採番する。type 省略時は zatsudan、goal 省略時は chat（#284）。
  router.post("/", requireAuth, validateBody(CreateChannelSchema), (req, res, next) => {
    const { label, type, goal } = req.body as CreateChannelInput;
    channelRepo
      .create({ label, type, goal })
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
          throw new NotFoundError("ChannelNotFound");
        }
        res.status(200).json(channel);
      })
      .catch(next);
  });

  // チャンネル別メッセージ一覧（認証不要・#48）。postedAt <= now のみ返す（#183）。
  router.get("/:channelId/messages", (req, res, next) => {
    const { channelId } = req.params as { channelId: string };
    messageRepo
      .listByChannel(channelId)
      .then((messages) => res.status(200).json(messages))
      .catch(next);
  });

  // チャンネルへのメッセージ投稿（認証必須・#48）。createdEmployeeId は req.user.employeeId を使う。
  // 保存後、aiDeps があれば非同期で AI 会話生成を行う（#183）。エラーは握りつぶす。
  router.post(
    "/:channelId/messages",
    requireAuth,
    validateBody(CreateChannelMessageSchema),
    (req, res, next) => {
      const { channelId } = req.params as { channelId: string };
      const user = req.user!;
      if (!user.employeeId) {
        next(new BadRequestError("EmployeeNotLinked"));
        return;
      }
      const { text } = req.body as { text: string };
      channelRepo
        .findById(channelId)
        .then((channel) => {
          if (!channel) {
            throw new NotFoundError("ChannelNotFound");
          }
          const now = new Date();
          return messageRepo
            .createMany([{ createdEmployeeId: user.employeeId!, channel: channelId, text, postedAt: now }])
            .then(([created]) => {
              res.status(201).json(created);
              // 非同期 AI 生成（#183）。レスポンス後に実行し、失敗してもユーザー投稿は守る。
              if (aiDeps) {
                void generateAiResponsesForChannel(channelId, channel.label, now, {
                  membershipRepo,
                  employeeRepo: aiDeps.employeeRepo,
                  messageRepo,
                  appSettingRepo: aiDeps.appSettingRepo,
                  generate: aiDeps.generate,
                });
              }
            });
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
