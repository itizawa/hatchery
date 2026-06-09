import type { Channel, ChannelGoal, CreateChannelInput, UpdateChannelInput } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { ChannelRepository, ChannelSummary } from "./channelRepository.js";

/** Prisma の goalType / goalInstructions フラットフィールドをドメインの ChannelGoal に変換する（#284）。 */
function toGoal(goalType: string, goalInstructions: string | null): ChannelGoal {
  return {
    type: goalType as ChannelGoal["type"],
    ...(goalInstructions !== null ? { instructions: goalInstructions } : {}),
  };
}

/** ChannelRepository の Prisma / PostgreSQL 実装（一覧・作成・更新 / #37 / #47 / #54 / #284）。 */
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<Channel[]> {
    const rows = await this.prisma.channel.findMany({
      select: { id: true, label: true, type: true, goalType: true, goalInstructions: true },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      type: r.type,
      goal: toGoal(r.goalType, r.goalInstructions),
    }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    const created = await this.prisma.channel.create({
      data: {
        label: input.label,
        type: input.type,
        goalType: input.goal.type,
        goalInstructions: input.goal.instructions ?? null,
      },
      select: { id: true, label: true, type: true, goalType: true, goalInstructions: true },
    });
    return {
      id: created.id,
      label: created.label,
      type: created.type,
      goal: toGoal(created.goalType, created.goalInstructions),
    };
  }

  async update(id: string, input: UpdateChannelInput): Promise<Channel | null> {
    try {
      const updated = await this.prisma.channel.update({
        where: { id },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.goal !== undefined && {
            goalType: input.goal.type,
            goalInstructions: input.goal.instructions ?? null,
          }),
        },
        select: { id: true, label: true, type: true, goalType: true, goalInstructions: true },
      });
      return {
        id: updated.id,
        label: updated.label,
        type: updated.type,
        goal: toGoal(updated.goalType, updated.goalInstructions),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return null;
      }
      throw e;
    }
  }

  async findById(id: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findUnique({
      where: { id },
      select: { id: true, label: true, type: true, goalType: true, goalInstructions: true },
    });
    return row
      ? { id: row.id, label: row.label, type: row.type, goal: toGoal(row.goalType, row.goalInstructions) }
      : null;
  }

  async getSummary(channelId: string): Promise<ChannelSummary | null> {
    const row = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { summary: true, summaryUpdatedAt: true },
    });
    return row ? { summary: row.summary, summaryUpdatedAt: row.summaryUpdatedAt } : null;
  }

  async updateSummary(channelId: string, summary: string): Promise<void> {
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { summary, summaryUpdatedAt: new Date() },
    });
  }
}
