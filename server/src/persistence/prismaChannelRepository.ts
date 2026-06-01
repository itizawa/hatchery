import { randomUUID } from "node:crypto";

import type { Channel, CreateChannelInput } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { ChannelRepository } from "./channelRepository.js";

/** ChannelRepository の Prisma / PostgreSQL 実装（一覧・作成・名称更新 / #37 / #47）。 */
export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<Channel[]> {
    const rows = await this.prisma.channel.findMany({
      select: { id: true, label: true },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ({ id: r.id, label: r.label }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    // Channel.id は DB 既定を持たないため、ユーザー作成チャンネルの id はここで採番する。
    const created = await this.prisma.channel.create({
      data: { id: randomUUID(), label: input.label },
      select: { id: true, label: true },
    });
    return { id: created.id, label: created.label };
  }

  async updateLabel(id: string, label: string): Promise<Channel | null> {
    const updated = await this.prisma.channel.updateMany({ where: { id }, data: { label } });
    if (updated.count === 0) return null;
    return { id, label };
  }
}
