import type { PrismaClient } from "@prisma/client";

import type {
  CommentCreateInput,
  CommentRecord,
  CommentRepository,
  RevealFilterOptions,
} from "./commentRepository.js";

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
  parentCommentId: string | null;
  isSummary: boolean;
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
    parentCommentId: row.parentCommentId,
    isSummary: row.isSummary,
  };
}

/** CommentRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaCommentRepository(prisma: PrismaClient): CommentRepository {
  return {
    // eslint-disable-next-line max-params
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
              parentCommentId: input.parentCommentId ?? null,
              isSummary: input.isSummary ?? false,
              // createdAt は input から注入可能（#556 ドリップ割当）。省略時は DB @default(now())。
              ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
            },
          }),
        ),
      );
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listByPost(postId: string, options?: RevealFilterOptions): Promise<CommentRecord[]> {
      const now = options?.now;
      const rows = await prisma.comment.findMany({
        where: {
          postId,
          // reveal フィルタ（#556）: now が渡された場合、createdAt > now のコメントを除外する。
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listByCommunity(communityId: string, limit = 50, options?: RevealFilterOptions): Promise<CommentRecord[]> {
      const now = options?.now;
      const rows = await prisma.comment.findMany({
        where: {
          communityId,
          // reveal フィルタ（#556）: now が渡された場合、createdAt > now のコメントを除外する。
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(toRecord);
    },

    async findById(id: string): Promise<CommentRecord | null> {
      const row = await prisma.comment.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },

    // eslint-disable-next-line max-params
    async countByPostIds(postIds: string[], options?: RevealFilterOptions): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      if (postIds.length === 0) return counts;
      const now = options?.now;
      // N+1 回避: groupBy で 1 クエリにまとめて集計する（#500）。
      // reveal フィルタ（#875）: now が渡された場合、createdAt > now のコメントを除外する。
      const grouped = await prisma.comment.groupBy({
        by: ["postId"],
        where: {
          postId: { in: postIds },
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        _count: { _all: true },
      });
      for (const g of grouped) {
        counts.set(g.postId, g._count._all);
      }
      return counts;
    },

    // eslint-disable-next-line max-params
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

    // eslint-disable-next-line max-params
    async updateParentCommentId(id: string, parentCommentId: string | null): Promise<CommentRecord | null> {
      try {
        const row = await prisma.comment.update({
          where: { id },
          data: { parentCommentId },
        });
        return toRecord(row);
      } catch {
        return null;
      }
    },

    async listByWorker({
      workerId,
      limit = 20,
      cursor,
    }: {
      workerId: string;
      limit?: number;
      cursor?: string;
    }): Promise<{ comments: CommentRecord[]; nextCursor: string | null }> {
      const rows = await prisma.comment.findMany({
        where: { author: workerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasNext = rows.length > limit;
      const comments = rows.slice(0, limit).map(toRecord);
      const nextCursor = hasNext ? (comments[comments.length - 1]?.id ?? null) : null;
      return { comments, nextCursor };
    },

    async count(): Promise<number> {
      return prisma.comment.count();
    },
  };
}
