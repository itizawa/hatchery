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
  isPinned: boolean;
  pinnedAt: Date | null;
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
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt,
  };
}

/** 新着順（createdAt 降順 → id 降順）の Prisma orderBy（#1179）。 */
const RECENT_ORDER_BY: Prisma.PostFindManyArgs["orderBy"] = [{ createdAt: "desc" }, { id: "desc" }];

/** 人気順（score 降順 → createdAt 降順 → id 降順）の Prisma orderBy（#1179）。 */
const POPULAR_ORDER_BY: Prisma.PostFindManyArgs["orderBy"] = [
  { score: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

/**
 * 新着順 keyset cursor の where 条件をマージする（#1179）。
 * cursor が不正な場合は INVALID_CURSOR を throw する（呼び出し元は async 関数のため rejected promise になる）。
 */
function withRecentCursor({
  where,
  cursor,
}: {
  where: Prisma.PostWhereInput;
  cursor?: string;
}): Prisma.PostWhereInput {
  if (cursor === undefined) return where;
  const payload = decodeCursor(cursor);
  if (!payload) throw new Error("INVALID_CURSOR");
  const cursorDate = new Date(payload.createdAt);
  return {
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

/**
 * 人気順 keyset cursor の where 条件をマージする（#1179）。
 * `listByCommunityPopularPaged`・`listPopularPaged` の両方から再利用し、
 * 人気順の keyset 条件（score→createdAt→id）を単一情報源にする。
 * cursor が不正な場合は INVALID_CURSOR を throw する。
 */
function withPopularCursor({
  where,
  cursor,
}: {
  where: Prisma.PostWhereInput;
  cursor?: string;
}): Prisma.PostWhereInput {
  if (cursor === undefined) return where;
  const payload = decodePopularCursor(cursor);
  if (!payload) throw new Error("INVALID_CURSOR");
  const cursorDate = new Date(payload.createdAt);
  return {
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

/**
 * ページ取得の共通処理（#1179）。cursor の decode・where 構築は呼び出し側
 * （withRecentCursor / withPopularCursor）が担い、本関数は組み立て済みの where/orderBy から
 * limit+1 件取得し、hasMore 判定・nextCursor encode のみを行う。
 */
async function findPage({
  prisma,
  where,
  orderBy,
  limit,
  encode,
}: {
  prisma: PrismaClient;
  where: Prisma.PostWhereInput;
  orderBy: Prisma.PostFindManyArgs["orderBy"];
  limit: number;
  encode: (record: PostRecord) => string;
}): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
  const rows = await prisma.post.findMany({ where, orderBy, take: limit + 1 });
  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const last = posts.at(-1);
  const nextCursor = hasMore && last ? encode(toRecord(last)) : null;
  return { posts: posts.map(toRecord), nextCursor };
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
      excludePostIds,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
      excludePostIds?: string[];
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      const base: Prisma.PostWhereInput = {
        communityId,
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        ...(excludePostIds && excludePostIds.length > 0 ? { id: { notIn: excludePostIds } } : {}),
      };
      const where = withRecentCursor({ where: base, cursor });

      return findPage({ prisma, where, orderBy: RECENT_ORDER_BY, limit, encode: encodeCursor });
    },

    async listByCommunityPopularPaged({
      communityId,
      cursor,
      limit = 20,
      options,
      excludePostIds,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
      excludePostIds?: string[];
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      const base: Prisma.PostWhereInput = {
        communityId,
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        ...(excludePostIds && excludePostIds.length > 0 ? { id: { notIn: excludePostIds } } : {}),
      };
      const where = withPopularCursor({ where: base, cursor });

      return findPage({ prisma, where, orderBy: POPULAR_ORDER_BY, limit, encode: encodePopularCursor });
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
      const base: Prisma.PostWhereInput = {
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };
      const where = withRecentCursor({ where: base, cursor });

      return findPage({ prisma, where, orderBy: RECENT_ORDER_BY, limit, encode: encodeCursor });
    },

    // eslint-disable-next-line max-params
    async listPopularPaged(
      cursor?: string,
      limit = 20,
      options?: RevealFilterOptions,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      const now = options?.now;
      const base: Prisma.PostWhereInput = {
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        ...(now !== undefined ? { createdAt: { lte: now } } : {}),
      };
      const where = withPopularCursor({ where: base, cursor });

      return findPage({ prisma, where, orderBy: POPULAR_ORDER_BY, limit, encode: encodePopularCursor });
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

    async pinPost({ id, pinnedAt }: { id: string; pinnedAt: Date }): Promise<PostRecord | null> {
      try {
        const row = await prisma.post.update({
          where: { id },
          data: { isPinned: true, pinnedAt },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async pinPostIfUnderLimit({
      id,
      pinnedAt,
      maxCount,
    }: {
      id: string;
      pinnedAt: Date;
      maxCount: number;
    }): Promise<PostRecord | "not_found" | "limit_exceeded"> {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const post = await tx.post.findUnique({ where: { id } });
            if (!post) return "not_found" as const;
            if (!post.isPinned) {
              const pinnedCount = await tx.post.count({
                where: { communityId: post.communityId, isPinned: true },
              });
              if (pinnedCount >= maxCount) return "limit_exceeded" as const;
            }
            const updated = await tx.post.update({
              where: { id },
              data: { isPinned: true, pinnedAt },
            });
            return toRecord(updated);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (err) {
        // SERIALIZABLE 分離レベルでの直列化失敗（同時 pin リクエストの競合・P2034）は、
        // 安全側に倒して上限超過扱いにする（#1089・TOCTOU 対策）。
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
          return "limit_exceeded" as const;
        }
        throw err;
      }
    },

    async unpinPost(id: string): Promise<PostRecord | null> {
      try {
        const row = await prisma.post.update({
          where: { id },
          data: { isPinned: false, pinnedAt: null },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async countPinnedByCommunity(communityId: string): Promise<number> {
      return prisma.post.count({ where: { communityId, isPinned: true } });
    },

    // eslint-disable-next-line max-params
    async listPinnedByCommunity(communityId: string, options?: RevealFilterOptions): Promise<PostRecord[]> {
      const now = options?.now;
      const rows = await prisma.post.findMany({
        where: {
          communityId,
          isPinned: true,
          ...(now !== undefined ? { createdAt: { lte: now } } : {}),
        },
        orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
      });
      return rows.map(toRecord);
    },

    async count(): Promise<number> {
      return prisma.post.count();
    },
  };
}
