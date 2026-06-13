import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  VoteDirection,
  VoteRecord,
  VoteRepository,
  VoteTargetType,
} from "./voteRepository.js";

/** Prisma の Vote 行（Exclusive Arc: postId / commentId のいずれか片方が非 null・#453）。 */
interface VoteRow {
  id: string;
  userId: string;
  postId: string | null;
  commentId: string | null;
  direction: VoteDirection;
  createdAt: Date;
}

/**
 * 多態的な (targetType, targetId) を Exclusive Arc の複合ユニーク where にマップする（#453）。
 * post 票なら userId_postId、comment 票なら userId_commentId を使う。
 */
function uniqueWhere(userId: string, targetType: VoteTargetType, targetId: string) {
  return targetType === "post"
    ? ({ userId_postId: { userId, postId: targetId } } as const)
    : ({ userId_commentId: { userId, commentId: targetId } } as const);
}

/** Exclusive Arc の行を多態的な VoteRecord に戻す（postId / commentId → targetType / targetId）。 */
function toRecord(row: VoteRow): VoteRecord {
  const targetType: VoteTargetType = row.postId !== null ? "post" : "comment";
  const targetId = row.postId ?? row.commentId ?? "";
  return {
    id: row.id,
    userId: row.userId,
    targetType,
    targetId,
    direction: row.direction,
    createdAt: row.createdAt,
  };
}

/** VoteRepository の Prisma / PostgreSQL 実装（ADR-0019 / ADR-0025 / ADR-0031 #453）。 */
export function createPrismaVoteRepository(prisma: PrismaClient): VoteRepository {
  /**
   * toggle/switch ロジックを Prisma クライアント（または同一トランザクションの tx）上で実行し
   * scoreDelta を返す。voteAndApplyScore では tx を渡して vote と score 更新を原子化する。
   */
  async function applyVoteMutation(
    client: Prisma.TransactionClient,
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
    direction: VoteDirection,
  ): Promise<number> {
    const where = uniqueWhere(userId, targetType, targetId);
    const existing = await client.vote.findUnique({ where });

    if (!existing) {
      const data =
        targetType === "post"
          ? { userId, postId: targetId, direction }
          : { userId, commentId: targetId, direction };
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
    async findVote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
    ): Promise<VoteRecord | null> {
      const row = await prisma.vote.findUnique({
        where: uniqueWhere(userId, targetType, targetId),
      });
      return row ? toRecord(row) : null;
    },

    async vote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
      direction: VoteDirection,
    ): Promise<{ scoreDelta: number }> {
      const scoreDelta = await applyVoteMutation(prisma, userId, targetType, targetId, direction);
      return { scoreDelta };
    },

    async voteAndApplyScore(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
      direction: VoteDirection,
      applyScore: (delta: number) => Promise<number | null>,
    ): Promise<{ scoreDelta: number; score: number | null }> {
      // Prisma 実装は同一トランザクション内で対象 score を直接更新し原子化するため、
      // ポートの applyScore コールバック（in-memory 用の差し込み口）は使わない（#453）。
      void applyScore;
      return prisma.$transaction(async (tx) => {
        const scoreDelta = await applyVoteMutation(tx, userId, targetType, targetId, direction);
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
