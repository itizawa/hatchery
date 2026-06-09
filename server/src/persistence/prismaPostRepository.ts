import type { PrismaClient } from "@prisma/client";

import type { PostCreateInput, PostRecord, PostRepository } from "./postRepository.js";

function toRecord(row: {
  id: string;
  communityId: string;
  slotKey: string;
  seq: number;
  author: string;
  title: string;
  text: string;
  score: number;
  createdAt: Date;
}): PostRecord {
  return {
    id: row.id,
    communityId: row.communityId,
    slotKey: row.slotKey,
    seq: row.seq,
    author: row.author,
    title: row.title,
    text: row.text,
    score: row.score,
    createdAt: row.createdAt,
  };
}

/** PostRepository の Prisma / PostgreSQL 実装（#306）。 */
export class PrismaPostRepository implements PostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]> {
    if (inputs.length === 0) return [];

    const created: PostRecord[] = [];
    for (const input of inputs) {
      // upsert: (communityId, slotKey, seq) の複合ユニークで二重発火をガード
      const row = await this.prisma.post.upsert({
        where: {
          communityId_slotKey_seq: {
            communityId,
            slotKey: input.slotKey,
            seq: input.seq,
          },
        },
        update: {}, // 既存レコードは更新しない（スキップ）
        create: {
          communityId,
          slotKey: input.slotKey,
          seq: input.seq,
          author: input.author,
          title: input.title,
          text: input.text,
        },
      });
      created.push(toRecord(row));
    }
    return created;
  }

  async listByCommunity(communityId: string, limit = 50): Promise<PostRecord[]> {
    const rows = await this.prisma.post.findMany({
      where: { communityId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<PostRecord | null> {
    const row = await this.prisma.post.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async addScore(id: string, delta: number): Promise<PostRecord | null> {
    try {
      const row = await this.prisma.post.update({
        where: { id },
        data: { score: { increment: delta } },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async listByCommunityIds(communityIds: string[], limit = 50): Promise<PostRecord[]> {
    if (communityIds.length === 0) return [];
    const rows = await this.prisma.post.findMany({
      where: { communityId: { in: communityIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }
}
