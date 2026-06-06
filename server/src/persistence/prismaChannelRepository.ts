import { randomUUID } from "node:crypto";

import type { Channel, CreateChannelInput, UpdateChannelInput } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { ChannelRepository, ChannelSummary } from "./channelRepository.js";

/** ChannelRepository の Prisma / PostgreSQL 実装（一覧・作成・更新 / #37 / #47 / #54）。 */
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<Channel[]> {
    const rows = await this.prisma.channel.findMany({
      select: { id: true, label: true, type: true },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ({ id: r.id, label: r.label, type: r.type }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    // Channel.id は DB 既定を持たないため、ユーザー作成チャンネルの id はここで採番する。
    const created = await this.prisma.channel.create({
      data: { id: randomUUID(), label: input.label, type: input.type },
      select: { id: true, label: true, type: true },
    });
    return { id: created.id, label: created.label, type: created.type };
  }

  async update(id: string, input: UpdateChannelInput): Promise<Channel | null> {
    try {
      const updated = await this.prisma.channel.update({
        where: { id },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.type !== undefined && { type: input.type }),
        },
        select: { id: true, label: true, type: true },
      });
      return { id: updated.id, label: updated.label, type: updated.type };
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
      select: { id: true, label: true, type: true },
    });
    return row ? { id: row.id, label: row.label, type: row.type } : null;
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
