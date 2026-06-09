import type { PrismaClient } from "@prisma/client";

import type { CommentCreateInput, CommentRecord, CommentRepository } from "./commentRepository.js";

function toRecord(row: {
  id: string;
  communityId: string;
  postId: string;
  slotKey: string;
  seq: number;
  author: string;
  text: string;
  score: number;
  createdAt: Date;
}): CommentRecord {
  return {
    id: row.id,
    communityId: row.communityId,
    postId: row.postId,
    slotKey: row.slotKey,
    seq: row.seq,
    author: row.author,
    text: row.text,
    score: row.score,
    createdAt: row.createdAt,
  };
}

/** CommentRepository の Prisma / PostgreSQL 実装（#306）。 */
export class PrismaCommentRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(communityId: string, inputs: CommentCreateInput[]): Promise<CommentRecord[]> {
    if (inputs.length === 0) return [];

    const created: CommentRecord[] = [];
    for (const input of inputs) {
      // upsert: (communityId, slotKey, seq) の複合ユニークで二重発火をガード
      const row = await this.prisma.comment.upsert({
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
          postId: input.postId,
          slotKey: input.slotKey,
          seq: input.seq,
          author: input.author,
          text: input.text,
        },
      });
      created.push(toRecord(row));
    }
    return created;
  }

  async listByPost(postId: string): Promise<CommentRecord[]> {
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<CommentRecord | null> {
    const row = await this.prisma.comment.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async addScore(id: string, delta: number): Promise<CommentRecord | null> {
    try {
      const row = await this.prisma.comment.update({
        where: { id },
        data: { score: { increment: delta } },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }
}
