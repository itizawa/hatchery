/**
 * 旧 Channel モデルは ADR-0019 / #305 によりスキーマから削除済み。
 * このファイルは #305 の API 移行完了後に削除する。
 * 旧 Prisma テーブルがないため、このクラスは使用不可（NoOp）として型整合のみ維持する。
 */
import type { Channel, CreateChannelInput, UpdateChannelInput } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { ChannelRepository, ChannelSummary } from "./channelRepository.js";

/** ChannelRepository の旧 Prisma 実装（旧スキーマ削除済み・#305 で廃止予定）。 */
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly prisma: PrismaClient) {
    void this.prisma; // 旧スキーマ削除済みのため未使用
  }

  async list(): Promise<Channel[]> {
    return [];
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    void input;
    throw new Error("PrismaChannelRepository は旧スキーマ削除済み（#305 で廃止予定）");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(id: string, input: UpdateChannelInput): Promise<Channel | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findById(id: string): Promise<Channel | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSummary(channelId: string): Promise<ChannelSummary | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateSummary(channelId: string, summary: string): Promise<void> {
    // NoOp: 旧スキーマ削除済み
  }
}
