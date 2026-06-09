/**
 * 旧 ChannelEmployee モデルは ADR-0019 / #305 によりスキーマから削除済み。
 * このファイルは #305 の API 移行完了後に削除する。
 * 旧 Prisma テーブルがないため、このクラスは使用不可（NoOp）として型整合のみ維持する。
 */
import type { PrismaClient } from "@prisma/client";

import type { ChannelMembershipRepository } from "./channelMembershipRepository.js";

/** ChannelMembershipRepository の旧 Prisma 実装（旧スキーマ削除済み・#305 で廃止予定）。 */
export class PrismaChannelMembershipRepository implements ChannelMembershipRepository {
  constructor(private readonly prisma: PrismaClient) {
    void this.prisma; // 旧スキーマ削除済みのため未使用
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addMember(channelId: string, employeeId: string): Promise<void> {
    // NoOp: 旧スキーマ削除済み
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async removeMember(channelId: string, employeeId: string): Promise<void> {
    // NoOp: 旧スキーマ削除済み
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listEmployeeIdsByChannel(channelId: string): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listChannelIdsByEmployee(employeeId: string): Promise<string[]> {
    return [];
  }

  async listMembershipByChannel(): Promise<Record<string, string[]>> {
    return {};
  }
}
