import type { TrendingItem } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import { buildTrendingExcerpt } from "./trendingItemBuilder.js";
import type {
  VoteDirection,
  VoteRecord,
  VoteRepository,
  VoteTargetType,
} from "./voteRepository.js";

/** Prisma の Vote 行（Exclusive Arc: postId / commentId のいずれか片方が非 null・#453 / #777: sessionId 追加）。 */
interface VoteRow {
  id: string;
  sessionId: string;
  userId: string | null;
  postId: string | null;
  commentId: string | null;
  direction: VoteDirection;
  createdAt: Date;
}

/**
 * 多態的な (targetType, targetId) を Exclusive Arc の複合ユニーク where にマップする（#453 / #777）。
 * post 票なら sessionId_postId、comment 票なら sessionId_commentId を使う。
 */
function uniqueWhere({ sessionId, targetType, targetId }: { sessionId: string; targetType: VoteTargetType; targetId: string }) {
  return targetType === "post"
    ? ({ sessionId_postId: { sessionId, postId: targetId } } as const)
    : ({ sessionId_commentId: { sessionId, commentId: targetId } } as const);
}

/** Exclusive Arc の行を多態的な VoteRecord に戻す（postId / commentId → targetType / targetId）。 */
function toRecord(row: VoteRow): VoteRecord {
  const targetType: VoteTargetType = row.postId !== null ? "post" : "comment";
  const targetId = row.postId ?? row.commentId ?? "";
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    targetType,
    targetId,
    direction: row.direction,
    createdAt: row.createdAt,
  };
}

/** VoteRepository の Prisma / PostgreSQL 実装（ADR-0019 / ADR-0025 / ADR-0031 #453 / #777）。 */
export function createPrismaVoteRepository(prisma: PrismaClient): VoteRepository {
  // eslint-disable-next-line max-params
  async function applyVoteMutation(
    client: Prisma.TransactionClient,
    { sessionId, userId, targetType, targetId, direction }: {
      sessionId: string;
      userId: string | null;
      targetType: VoteTargetType;
      targetId: string;
      direction: VoteDirection;
    },
  ): Promise<{ scoreDelta: number; currentDirection: VoteDirection | null }> {
    const where = uniqueWhere({ sessionId, targetType, targetId });
    const existing = await client.vote.findUnique({ where });

    if (!existing) {
      const data =
        targetType === "post"
          ? { sessionId, userId, postId: targetId, direction }
          : { sessionId, userId, commentId: targetId, direction };
      await client.vote.create({ data });
      return { scoreDelta: direction === "up" ? 1 : -1, currentDirection: direction };
    }

    if (existing.direction === direction) {
      await client.vote.delete({ where });
      return { scoreDelta: direction === "up" ? -1 : 1, currentDirection: null };
    }

    await client.vote.update({ where, data: { direction } });
    return { scoreDelta: direction === "up" ? 2 : -2, currentDirection: direction };
  }

  return {
    async findVote({
      sessionId,
      targetType,
      targetId,
    }: {
      sessionId: string;
      targetType: VoteTargetType;
      targetId: string;
    }): Promise<VoteRecord | null> {
      const row = await prisma.vote.findUnique({
        where: uniqueWhere({ sessionId, targetType, targetId }),
      });
      return row ? toRecord(row as VoteRow) : null;
    },

    async vote({
      sessionId,
      userId,
      targetType,
      targetId,
      direction,
    }: {
      sessionId: string;
      userId: string | null;
      targetType: VoteTargetType;
      targetId: string;
      direction: VoteDirection;
    }): Promise<{ scoreDelta: number }> {
      const { scoreDelta } = await applyVoteMutation(prisma, { sessionId, userId, targetType, targetId, direction });
      return { scoreDelta };
    },

    async voteAndApplyScore({
      sessionId,
      userId,
      targetType,
      targetId,
      direction,
      applyScore,
    }: {
      sessionId: string;
      userId: string | null;
      targetType: VoteTargetType;
      targetId: string;
      direction: VoteDirection;
      applyScore: (delta: number) => Promise<number | null>;
    }): Promise<{ scoreDelta: number; score: number | null; currentDirection: VoteDirection | null }> {
      // Prisma 実装は同一トランザクション内で対象 score を直接更新し原子化するため、
      // ポートの applyScore コールバック（in-memory 用の差し込み口）は使わない（#453）。
      void applyScore;
      return prisma.$transaction(async (tx) => {
        const { scoreDelta, currentDirection } = await applyVoteMutation(tx, { sessionId, userId, targetType, targetId, direction });
        if (targetType === "post") {
          const updated = await tx.post.update({
            where: { id: targetId },
            data: { score: { increment: scoreDelta } },
          });
          return { scoreDelta, score: updated.score, currentDirection };
        }
        const updated = await tx.comment.update({
          where: { id: targetId },
          data: { score: { increment: scoreDelta } },
        });
        return { scoreDelta, score: updated.score, currentDirection };
      });
    },

    async findVotesBySessionAndTargets({
      sessionId,
      targetType,
      targetIds,
    }: {
      sessionId: string;
      targetType: VoteTargetType;
      targetIds: string[];
    }): Promise<Map<string, VoteDirection>> {
      if (targetIds.length === 0) return new Map();
      const rows = await prisma.vote.findMany({
        where: {
          sessionId,
          ...(targetType === "post"
            ? { postId: { in: targetIds } }
            : { commentId: { in: targetIds } }),
        },
      });
      const map = new Map<string, VoteDirection>();
      for (const row of rows) {
        const targetId = targetType === "post" ? row.postId : row.commentId;
        if (targetId) map.set(targetId, row.direction as VoteDirection);
      }
      return map;
    },

    async netScoresByWorkerSince(since: Date): Promise<Map<string, number>> {
      // vote を Post / Comment 経由で author（workerId）に解決し worker 単位で集計する（#665 / ADR-0032）。
      const rows = await prisma.$queryRaw<{ author: string; netScore: bigint }[]>(Prisma.sql`
        SELECT "author", SUM(CASE WHEN "direction" = 'up' THEN 1 ELSE -1 END) AS "netScore"
        FROM (
          SELECT p."author" AS "author", v."direction" AS "direction"
          FROM "Vote" v
          JOIN "Post" p ON p."id" = v."postId"
          WHERE v."postId" IS NOT NULL AND v."createdAt" >= ${since}
          UNION ALL
          SELECT c."author" AS "author", v."direction" AS "direction"
          FROM "Vote" v
          JOIN "Comment" c ON c."id" = v."commentId"
          WHERE v."commentId" IS NOT NULL AND v."createdAt" >= ${since}
        ) AS resolved
        GROUP BY "author"
      `);

      const scores = new Map<string, number>();
      for (const row of rows) {
        scores.set(row.author, Number(row.netScore));
      }
      return scores;
    },

    async netScoresByCommunitySince(since: Date): Promise<Map<string, number>> {
      // #453: postId / commentId の本物 FK 経由で community に解決し、
      // up を +1 / down を -1 として community 単位に集計する（#486 / ADR-0030）。
      const rows = await prisma.$queryRaw<{ communityId: string; netScore: bigint }[]>(Prisma.sql`
        SELECT "communityId", SUM(CASE WHEN "direction" = 'up' THEN 1 ELSE -1 END) AS "netScore"
        FROM (
          SELECT p."communityId" AS "communityId", v."direction" AS "direction"
          FROM "Vote" v
          JOIN "Post" p ON p."id" = v."postId"
          WHERE v."postId" IS NOT NULL AND v."createdAt" >= ${since}
          UNION ALL
          SELECT c."communityId" AS "communityId", v."direction" AS "direction"
          FROM "Vote" v
          JOIN "Comment" c ON c."id" = v."commentId"
          WHERE v."commentId" IS NOT NULL AND v."createdAt" >= ${since}
        ) AS resolved
        GROUP BY "communityId"
      `);

      const scores = new Map<string, number>();
      for (const row of rows) {
        scores.set(row.communityId, Number(row.netScore));
      }
      return scores;
    },

    async voteCountsPerUserPerCommunitySince(since: Date): Promise<Map<string, Map<string, number>>> {
      const rows = await prisma.$queryRaw<{ userId: string; communityId: string; cnt: bigint }[]>(Prisma.sql`
        SELECT "userId", "communityId", COUNT(*) AS "cnt"
        FROM (
          SELECT v."userId" AS "userId", p."communityId" AS "communityId"
          FROM "Vote" v
          JOIN "Post" p ON p."id" = v."postId"
          WHERE v."postId" IS NOT NULL AND v."userId" IS NOT NULL AND v."createdAt" >= ${since}
          UNION ALL
          SELECT v."userId" AS "userId", c."communityId" AS "communityId"
          FROM "Vote" v
          JOIN "Comment" c ON c."id" = v."commentId"
          WHERE v."commentId" IS NOT NULL AND v."userId" IS NOT NULL AND v."createdAt" >= ${since}
        ) AS resolved
        GROUP BY "userId", "communityId"
      `);

      const result = new Map<string, Map<string, number>>();
      for (const row of rows) {
        const userMap = result.get(row.userId) ?? new Map<string, number>();
        userMap.set(row.communityId, (userMap.get(row.communityId) ?? 0) + Number(row.cnt));
        result.set(row.userId, userMap);
      }
      return result;
    },

    async rawVoteCountsByWorkerSince(since: Date): Promise<Map<string, number>> {
      const rows = await prisma.$queryRaw<{ workerId: string; cnt: bigint }[]>(Prisma.sql`
        SELECT "workerId", COUNT(*) AS "cnt"
        FROM (
          SELECT p."author" AS "workerId"
          FROM "Vote" v
          JOIN "Post" p ON p."id" = v."postId"
          WHERE v."postId" IS NOT NULL AND v."createdAt" >= ${since}
          UNION ALL
          SELECT c."author" AS "workerId"
          FROM "Vote" v
          JOIN "Comment" c ON c."id" = v."commentId"
          WHERE v."commentId" IS NOT NULL AND v."createdAt" >= ${since}
        ) AS resolved
        GROUP BY "workerId"
      `);

      const result = new Map<string, number>();
      for (const row of rows) {
        result.set(row.workerId, Number(row.cnt));
      }
      return result;
    },

    async trendingItemsSince({ since, limit }: { since: Date; limit: number }): Promise<TrendingItem[]> {
      // vote を Post / Comment 経由で本文・community に解決し、net_score（up:+1 / down:-1）降順で
      // 上位 limit 件を返す（#1065）。excerpt はマルチバイト文字のコードポイント単位切り詰めを
      // SQL 側で信頼できないため、TypeScript 側（buildTrendingExcerpt）で構築する。
      const rows = await prisma.$queryRaw<
        {
          itemType: "post" | "comment";
          id: string;
          postId: string;
          text: string;
          communityId: string;
          communitySlug: string;
          createdAt: Date;
          netScore: bigint;
        }[]
      >(Prisma.sql`
        SELECT * FROM (
          SELECT
            'post' AS "itemType",
            p."id" AS "id",
            p."id" AS "postId",
            p."text" AS "text",
            p."communityId" AS "communityId",
            cm."slug" AS "communitySlug",
            p."createdAt" AS "createdAt",
            SUM(CASE WHEN v."direction" = 'up' THEN 1 ELSE -1 END) AS "netScore"
          FROM "Vote" v
          JOIN "Post" p ON p."id" = v."postId"
          JOIN "Community" cm ON cm."id" = p."communityId"
          WHERE v."postId" IS NOT NULL AND v."createdAt" >= ${since}
          GROUP BY p."id", p."text", p."communityId", cm."slug", p."createdAt"

          UNION ALL

          SELECT
            'comment' AS "itemType",
            c."id" AS "id",
            c."postId" AS "postId",
            c."text" AS "text",
            c."communityId" AS "communityId",
            cm."slug" AS "communitySlug",
            c."createdAt" AS "createdAt",
            SUM(CASE WHEN v."direction" = 'up' THEN 1 ELSE -1 END) AS "netScore"
          FROM "Vote" v
          JOIN "Comment" c ON c."id" = v."commentId"
          JOIN "Community" cm ON cm."id" = c."communityId"
          WHERE v."commentId" IS NOT NULL AND v."createdAt" >= ${since}
          GROUP BY c."id", c."postId", c."text", c."communityId", cm."slug", c."createdAt"
        ) AS resolved
        ORDER BY "netScore" DESC
        LIMIT ${limit}
      `);

      return rows.map((row) => ({
        type: row.itemType,
        id: row.id,
        post_id: row.postId,
        excerpt: buildTrendingExcerpt(row.text),
        community_id: row.communityId,
        community_slug: row.communitySlug,
        net_score: Number(row.netScore),
        created_at: row.createdAt.toISOString(),
      }));
    },
  };
}
