import type { Message } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { MessageRecord, MessageRepository } from "./messageRepository.js";

function toMessageRecord(row: {
  id: string;
  speaker: string;
  channel: string;
  text: string;
  createdAt: Date;
  order: number;
}): MessageRecord {
  return {
    id: row.id,
    speaker: row.speaker,
    channel: row.channel,
    text: row.text,
    createdAt: row.createdAt,
    order: row.order,
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

  async createMany(input: Message[]): Promise<MessageRecord[]> {
    const rows = await this.prisma.$transaction(
      input.map((m, index) =>
        this.prisma.message.create({
          data: {
            speaker: m.speaker,
            channel: m.channel,
            text: m.text,
            order: index,
          },
        }),
      ),
    );
    return rows.map(toMessageRecord);
  }
}
