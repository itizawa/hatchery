/**
 * 旧 Message モデルは ADR-0019 / #305 によりスキーマから削除済み。
 * このファイルは #305 の API 移行完了後に削除する。
 * 旧 Prisma テーブルがないため、このクラスは使用不可（NoOp）として型整合のみ維持する。
 */
import type { PrismaClient } from "@prisma/client";

import type { MessageCreateInput, MessageRecord, MessageRepository, PlanningMessageInput } from "./messageRepository.js";

/** MessageRepository の旧 Prisma 実装（旧スキーマ削除済み・#305 で廃止予定）。 */
export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {
    void this.prisma; // 旧スキーマ削除済みのため未使用
  }

  async list(): Promise<MessageRecord[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createMany(input: MessageCreateInput[]): Promise<MessageRecord[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listByChannel(channelId: string): Promise<MessageRecord[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listRecentByChannel(channelId: string, limit: number): Promise<MessageRecord[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listByChannelSince(channelId: string, since: Date): Promise<MessageRecord[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord> {
    throw new Error("PrismaMessageRepository は旧スキーマ削除済み（#305 で廃止予定）");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateIssueRef(id: string, issueNumber: number, issueUrl: string): Promise<MessageRecord | null> {
    return null;
  }
}
