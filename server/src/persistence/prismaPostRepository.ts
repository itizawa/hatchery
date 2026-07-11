import { Prisma, type PrismaClient } from "@prisma/client";

import {
  decodeCursor,
  decodePopularCursor,
  encodeCursor,
  encodePopularCursor,
} from "./postRepository.js";
import type {
  CommunityPostStats,
  PostCreateInput,
  PostRecord,
  PostRepository,
  RevealFilterOptions,
} from "./postRepository.js";

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
  tags: string[];
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
    tags: row.tags,
  };
}

/** PostRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaPostRepository(prisma: PrismaClient): PostRepository {
  return {
    // eslint-disable-next-line max-params
    async createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]> {
      const rows = await prisma.$transaction(
        inputs.map((input) =>
          prisma.post.upsert({
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
              slotKey: input.slotKey,
              seq: input.seq,
              author: input.author,
              title: input.title,
              text: input.text,
              // createdAt は input から注入可能（#556 ドリップ割当）。省略時は DB @default(now())。
              ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
              // tags は input から注入可能（#1087）。省略時は DB @default([])。
              ...(input.tags !== undefined ? { tags: input.tags } : {}),
            },
          }),
        ),
      );
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listByCommunity(communityId: string, limit = 50, options?: RevealFilterOptions): Promise<PostRecord[]> {
      const now = options?.now;
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(toRecord);
    },

    async listByCommunityPaged({
      communityId,
      cursor,
      limit = 20,
      options,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      let where: Prisma.PostWhereInput = {
        communityId,
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };

      if (cursor !== undefined) {
        const payload = decodeCursor(cursor);
        if (!payload) throw new Error("INVALID_CURSOR");
        const cursorDate = new Date(payload.createdAt);
        where = {
          ...where,
          AND: [
            {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: { equals: cursorDate }, id: { lt: payload.id } },
              ],
            },
          ],
        };
      }

      const rows = await prisma.post.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? encodeCursor(toRecord(posts[posts.length - 1]!)) : null;

      return { posts: posts.map(toRecord), nextCursor };
    },

    async listByCommunityPopularPaged({
      communityId,
      cursor,
      limit = 20,
      options,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      let where: Prisma.PostWhereInput = {
        communityId,
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };

      if (cursor !== undefined) {
        const payload = decodePopularCursor(cursor);
        if (!payload) throw new Error("INVALID_CURSOR");
        const cursorDate = new Date(payload.createdAt);
        // keyset: score 降順 → createdAt 降順 → id 降順
        where = {
          ...where,
          AND: [
            {
              OR: [
                { score: { lt: payload.score } },
                { score: { equals: payload.score }, createdAt: { lt: cursorDate } },
                {
                  score: { equals: payload.score },
                  createdAt: { equals: cursorDate },
                  id: { lt: payload.id },
                },
              ],
            },
          ],
        };
      }

      const rows = await prisma.post.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? encodePopularCursor(toRecord(posts[posts.length - 1]!)) : null;

      return { posts: posts.map(toRecord), nextCursor };
    },

    async findById(id: string): Promise<PostRecord | null> {
      const row = await prisma.post.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },

    // eslint-disable-next-line max-params
    async addScore(id: string, delta: number): Promise<PostRecord | null> {
      try {
        const row = await prisma.post.update({
          where: { id },
          data: { score: { increment: delta } },
        });
        return toRecord(row);
      } catch {
        return null;
      }
    },

    // eslint-disable-next-line max-params
    async listLatest(limit = 50, options?: RevealFilterOptions): Promise<PostRecord[]> {
      const now = options?.now;
      const rows = await prisma.post.findMany({
        where: {
          // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listLatestPaged(
      cursor?: string,
      limit = 20,
      options?: RevealFilterOptions,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      let where: Prisma.PostWhereInput = {
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };

      if (cursor !== undefined) {
        const payload = decodeCursor(cursor);
        if (!payload) throw new Error("INVALID_CURSOR");
        const cursorDate = new Date(payload.createdAt);
        where = {
          ...where,
          AND: [
            {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: { equals: cursorDate }, id: { lt: payload.id } },
              ],
            },
          ],
        };
      }

      const rows = await prisma.post.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? encodeCursor(toRecord(posts[posts.length - 1]!)) : null;

      return { posts: posts.map(toRecord), nextCursor };
    },

    // eslint-disable-next-line max-params
    async listPopularPaged(
      cursor?: string,
      limit = 20,
      options?: RevealFilterOptions,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      let where: Prisma.PostWhereInput = {
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };

      if (cursor !== undefined) {
        const payload = decodePopularCursor(cursor);
        if (!payload) throw new Error("INVALID_CURSOR");
        const cursorDate = new Date(payload.createdAt);
        // keyset: score 降順 → createdAt 降順 → id 降順
        where = {
          ...where,
          AND: [
            {
              OR: [
                { score: { lt: payload.score } },
                { score: { equals: payload.score }, createdAt: { lt: cursorDate } },
                {
                  score: { equals: payload.score },
                  createdAt: { equals: cursorDate },
                  id: { lt: payload.id },
                },
              ],
            },
          ],
        };
      }

      const rows = await prisma.post.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? encodePopularCursor(toRecord(posts[posts.length - 1]!)) : null;

      return { posts: posts.map(toRecord), nextCursor };
    },

    async getStatsByCommunity(): Promise<Map<string, CommunityPostStats>> {
      // Prisma の groupBy で communityId ごとの count + max(createdAt) を一発集計（N+1 回避・#527）。
      const grouped = await prisma.post.groupBy({
        by: ["communityId"],
        _count: { id: true },
        _max: { createdAt: true },
      });

      const statsMap = new Map<string, CommunityPostStats>();
      for (const row of grouped) {
        statsMap.set(row.communityId, {
          postCount: row._count.id,
          lastPostAt: row._max.createdAt ?? null,
        });
      }
      return statsMap;
    },

    // eslint-disable-next-line max-params
    async listTopByCommunity(
      communityId: string,
      params: { since: Date; minScore: number; limit: number },
    ): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          score: { gte: params.minScore },
          createdAt: { gte: params.since },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: params.limit,
      });
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listRecentByCommunity(communityId: string, since: Date, limit = 100): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          createdAt: { gte: since },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    // eslint-disable-next-line max-params
    async listOldByCommunity(communityId: string, before: Date, limit = 20): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          createdAt: { lt: before },
          score: { gte: 0 },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    async listByAuthor({ authorId, limit = 20, now }: { authorId: string; limit?: number; now?: Date }): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        where: {
          author: authorId,
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    async search({ q, limit = 50, options }: { q: string; limit?: number; options?: RevealFilterOptions }): Promise<PostRecord[]> {
      const now = options?.now;
      const rows = await prisma.post.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { text: { contains: q, mode: "insensitive" } },
          ],
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    async listRelatedByTags({
      communityId,
      tags,
      excludePostId,
      limit,
      options,
    }: {
      communityId: string;
      tags: readonly string[];
      excludePostId: string;
      limit: number;
      options?: RevealFilterOptions;
    }): Promise<PostRecord[]> {
      if (tags.length === 0) return [];
      const now = options?.now;
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          id: { not: excludePostId },
          tags: { hasSome: [...tags] },
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    async updateTitleAndText({
      id,
      title,
      text,
    }: {
      id: string;
      title: string;
      text: string;
    }): Promise<PostRecord | null> {
      try {
        const row = await prisma.post.update({
          where: { id },
          data: { title, text },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },
  };
}
