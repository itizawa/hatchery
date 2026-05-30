import type { Message, Scene } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { SceneRecord, SceneRepository } from "./sceneRepository.js";

/** Prisma の Message 行を common の Message（speaker/channel/text）に射影する。 */
function toMessages(rows: { speaker: string; channel: string; text: string }[]): Message[] {
  return rows.map((m) => ({ speaker: m.speaker, channel: m.channel, text: m.text }));
}

/** SceneRepository の Prisma / PostgreSQL 実装。 */
export class PrismaSceneRepository implements SceneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<SceneRecord[]> {
    const scenes = await this.prisma.scene.findMany({
      include: { messages: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return scenes.map((s) => ({
      id: s.id,
      scene: s.summary,
      createdAt: s.createdAt,
      messages: toMessages(s.messages),
    }));
  }

  async create(input: Scene): Promise<SceneRecord> {
    const created = await this.prisma.scene.create({
      data: {
        summary: input.scene,
        messages: {
          create: input.messages.map((m, index) => ({
            speaker: m.speaker,
            channel: m.channel,
            text: m.text,
            order: index,
          })),
        },
      },
      include: { messages: { orderBy: { order: "asc" } } },
    });
    return {
      id: created.id,
      scene: created.summary,
      createdAt: created.createdAt,
      messages: toMessages(created.messages),
    };
  }
}
