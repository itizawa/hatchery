import type { PrismaClient } from "@prisma/client";

import type { MessageCreateInput, MessageRecord, MessageRepository, PlanningMessageInput } from "./messageRepository.js";

function toMessageRecord(row: {
  id: string;
  createdEmployeeId: string;
  channel: string;
  text: string;
  createdAt: Date;
  postedAt: Date;
  order: number;
  proposalTitle: string | null;
  proposalReason: string | null;
  proposalTargetUrl: string | null;
  issueNumber: number | null;
  issueUrl: string | null;
}): MessageRecord {
  return {
    id: row.id,
    createdEmployeeId: row.createdEmployeeId,
    channel: row.channel,
    text: row.text,
    createdAt: row.createdAt,
    postedAt: row.postedAt,
    order: row.order,
    ...(row.proposalTitle != null && { proposalTitle: row.proposalTitle }),
    ...(row.proposalReason != null && { proposalReason: row.proposalReason }),
    ...(row.proposalTargetUrl != null && { proposalTargetUrl: row.proposalTargetUrl }),
    ...(row.issueNumber != null && { issueNumber: row.issueNumber }),
    ...(row.issueUrl != null && { issueUrl: row.issueUrl }),
  };
}

/** MessageRepository の Prisma / PostgreSQL 実装（ADR-0009）。 */
export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<MessageRecord[]> {
    const rows = await this.prisma.message.findMany({
      orderBy: [{ createdAt: "asc" }, { order: "asc" }],
    });
    return rows.map(toMessageRecord);
  }

  async createMany(input: MessageCreateInput[]): Promise<MessageRecord[]> {
    const now = new Date();
    const rows = await this.prisma.$transaction(
      input.map((m, index) =>
        this.prisma.message.create({
          data: {
            createdEmployeeId: m.createdEmployeeId,
            channel: m.channel,
            text: m.text,
            postedAt: m.postedAt ?? now,
            order: index,
          },
        }),
      ),
    );
    return rows.map(toMessageRecord);
  }

  async listByChannel(channelId: string): Promise<MessageRecord[]> {
    const now = new Date();
    const rows = await this.prisma.message.findMany({
      where: { channel: channelId, postedAt: { lte: now } },
      orderBy: [{ postedAt: "asc" }, { order: "asc" }],
    });
    return rows.map(toMessageRecord);
  }

  async listRecentByChannel(channelId: string, limit: number): Promise<MessageRecord[]> {
    const rows = await this.prisma.message.findMany({
      where: { channel: channelId },
      orderBy: [{ createdAt: "desc" }, { order: "desc" }],
      take: Math.max(0, limit),
    });
    return rows.map(toMessageRecord);
  }

  async listByChannelSince(channelId: string, since: Date): Promise<MessageRecord[]> {
    const rows = await this.prisma.message.findMany({
      where: { channel: channelId, createdAt: { gte: since } },
      orderBy: [{ createdAt: "asc" }, { order: "asc" }],
    });
    return rows.map(toMessageRecord);
  }

  async createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord> {
    const lastInChannel = await this.prisma.message.findFirst({
      where: { channel: input.channel },
      orderBy: { order: "desc" },
    });
    const nextOrder = (lastInChannel?.order ?? -1) + 1;
    const row = await this.prisma.message.create({
      data: {
        createdEmployeeId: input.createdEmployeeId,
        channel: input.channel,
        text: input.text,
        order: nextOrder,
        proposalTitle: input.proposalTitle,
        proposalReason: input.proposalReason,
        proposalTargetUrl: input.proposalTargetUrl,
      },
    });
    return toMessageRecord(row);
  }

  async updateIssueRef(id: string, issueNumber: number, issueUrl: string): Promise<MessageRecord | null> {
    try {
      const row = await this.prisma.message.update({
        where: { id },
        data: { issueNumber, issueUrl },
      });
      return toMessageRecord(row);
    } catch {
      return null;
    }
  }
}
