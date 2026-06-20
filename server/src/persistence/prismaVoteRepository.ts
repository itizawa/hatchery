import { Prisma, type PrismaClient } from "@prisma/client";

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
  /**
   * toggle/switch ロジックを Prisma クライアント（または同一トランザクションの tx）上で実行し
   * scoreDelta を返す。voteAndApplyScore では tx を渡して vote と score 更新を原子化する。
   */
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
  ): Promise<number> {
    const where = uniqueWhere({ sessionId, targetType, targetId });
    const existing = await client.vote.findUnique({ where });

    if (!existing) {
      const data =
        targetType === "post"
          ? { sessionId, userId, postId: targetId, direction }
          : { sessionId, userId, commentId: targetId, direction };
      await client.vote.create({ data });
      return direction === "up" ? 1 : -1;
    }

    if (existing.direction === direction) {
      await client.vote.delete({ where });
      return direction === "up" ? -1 : 1;
    }

    await client.vote.update({ where, data: { direction } });
    return direction === "up" ? 2 : -2;
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
      const scoreDelta = await applyVoteMutation(prisma, { sessionId, userId, targetType, targetId, direction });
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
    }): Promise<{ scoreDelta: number; score: number | null }> {
      // Prisma 実装は同一トランザクション内で対象 score を直接更新し原子化するため、
      // ポートの applyScore コールバック（in-memory 用の差し込み口）は使わない（#453）。
      void applyScore;
      return prisma.$transaction(async (tx) => {
        const scoreDelta = await applyVoteMutation(tx, { sessionId, userId, targetType, targetId, direction });
        if (targetType === "post") {
          const updated = await tx.post.update({
            where: { id: targetId },
            data: { score: { increment: scoreDelta } },
          });
          return { scoreDelta, score: updated.score };
        }
        const updated = await tx.comment.update({
          where: { id: targetId },
          data: { score: { increment: scoreDelta } },
        });
        return { scoreDelta, score: updated.score };
      });
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
  };
}
