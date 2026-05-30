import type { PrismaClient } from "@prisma/client";

import type { ChannelMembershipRepository } from "./channelMembershipRepository.js";

/** ChannelMembershipRepository の Prisma / PostgreSQL 実装（多対多 ChannelEmployee / #33）。 */
export class PrismaChannelMembershipRepository implements ChannelMembershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async addMember(channelId: string, employeeId: string): Promise<void> {
    // 複合主キーで upsert することで重複追加を冪等にする。
    await this.prisma.channelEmployee.upsert({
      where: { channelId_employeeId: { channelId, employeeId } },
      update: {},
      create: { channelId, employeeId },
    });
  }

  async removeMember(channelId: string, employeeId: string): Promise<void> {
    await this.prisma.channelEmployee.deleteMany({ where: { channelId, employeeId } });
  }

  async listEmployeeIdsByChannel(channelId: string): Promise<string[]> {
    const rows = await this.prisma.channelEmployee.findMany({
      where: { channelId },
      select: { employeeId: true },
    });
    return rows.map((r) => r.employeeId);
  }

  async listChannelIdsByEmployee(employeeId: string): Promise<string[]> {
    const rows = await this.prisma.channelEmployee.findMany({
      where: { employeeId },
      select: { channelId: true },
    });
    return rows.map((r) => r.channelId);
  }

  async listMembershipByChannel(): Promise<Record<string, string[]>> {
    const rows = await this.prisma.channelEmployee.findMany({
      select: { channelId: true, employeeId: true },
    });
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      (map[row.channelId] ??= []).push(row.employeeId);
    }
    return map;
  }
}
