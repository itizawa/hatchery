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

/** CommentRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaCommentRepository(prisma: PrismaClient): CommentRepository {
  return {
    async createMany(communityId: string, inputs: CommentCreateInput[]): Promise<CommentRecord[]> {
      const rows = await prisma.$transaction(
        inputs.map((input) =>
          prisma.comment.upsert({
            where: {
              communityId_slotKey_seq: {
                communityId,
                slotKey: input.slotKey,
                seq: input.seq,
              },
            },
            update: {},
            create: {
              communityId,
              postId: input.postId,
              slotKey: input.slotKey,
              seq: input.seq,
              author: input.author,
              text: input.text,
            },
          }),
        ),
      );
      return rows.map(toRecord);
    },

    async listByPost(postId: string): Promise<CommentRecord[]> {
      const rows = await prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toRecord);
    },

    async listByCommunity(communityId: string, limit = 50): Promise<CommentRecord[]> {
      const rows = await prisma.comment.findMany({
        where: { communityId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(toRecord);
    },

    async findById(id: string): Promise<CommentRecord | null> {
      const row = await prisma.comment.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },

    async countByPostIds(postIds: string[]): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      if (postIds.length === 0) return counts;
      // N+1 回避: groupBy で 1 クエリにまとめて集計する（#500）。
      const grouped = await prisma.comment.groupBy({
        by: ["postId"],
        where: { postId: { in: postIds } },
        _count: { _all: true },
      });
      for (const g of grouped) {
        counts.set(g.postId, g._count._all);
      }
      return counts;
    },

    async addScore(id: string, delta: number): Promise<CommentRecord | null> {
      try {
        const row = await prisma.comment.update({
          where: { id },
          data: { score: { increment: delta } },
        });
        return toRecord(row);
      } catch {
        return null;
      }
    },
  };
}
