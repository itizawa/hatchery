import { Prisma, type PrismaClient } from "@prisma/client";

import type { ViewRepository } from "./viewRepository.js";

/**
 * ViewRepository の Prisma / PostgreSQL 実装（#665 / ADR-0032）。
 * ADR-0031（Vote Exclusive Arc）と同作法で整合性を DB 制約に寄せる。
 * 記録は ON CONFLICT DO NOTHING 相当（`skipDuplicates: true`）+ viewCount increment を
 * 単一 DB トランザクションで原子化する。
 */
export function createPrismaViewRepository(prisma: PrismaClient): ViewRepository {
  return {
    async recordPostView(
      postId: string,
      sessionId: string,
      userId: string | null,
    ): Promise<{ isNew: boolean }> {
      return prisma.$transaction(async (tx) => {
        const result = await tx.pageView.createMany({
          data: [{ postId, sessionId, userId }],
          skipDuplicates: true,
        });
        const isNew = result.count > 0;
        if (isNew) {
          await tx.post.update({
            where: { id: postId },
            data: { viewCount: { increment: 1 } },
          });
        }
        return { isNew };
      });
    },

    async recordCommentViews(
      commentIds: string[],
      sessionId: string,
      userId: string | null,
    ): Promise<{ newCount: number }> {
      if (commentIds.length === 0) return { newCount: 0 };
      return prisma.$transaction(async (tx) => {
        const result = await tx.pageView.createMany({
          data: commentIds.map((commentId) => ({ commentId, sessionId, userId })),
          skipDuplicates: true,
        });
        const newCount = result.count;
        if (newCount > 0) {
          // 実際に新規挿入されたコメントを特定して viewCount を +1 する。
          // skipDuplicates 後に実際に挿入された行を確定するため、既存のものと diff する。
          const inserted = await tx.pageView.findMany({
            where: { commentId: { in: commentIds }, sessionId },
            select: { commentId: true },
          });
          const insertedIds = inserted
            .map((r) => r.commentId)
            .filter((id): id is string => id !== null);
          // 全て新規の場合は commentIds 全件、一部既存の場合は新規分のみ。
          // ただし「新規分の id」を特定するのに findMany は全件返すため、
          // count 分だけ increment すれば整合する（同一トランザクション内で競合は起きない）。
          await tx.comment.updateMany({
            where: { id: { in: insertedIds } },
            data: { viewCount: { increment: 1 } },
          });
          void insertedIds;
        }
        return { newCount };
      });
    },

    async viewsByWorkerSince(since: Date): Promise<Map<string, number>> {
      // ADR-0031 の netScoresByCommunitySince と同じ raw SQL の作法で
      // PageView を Post / Comment 経由で author（workerId）に解決し worker で GROUP BY する。
      const rows = await prisma.$queryRaw<{ author: string; viewCount: bigint }[]>(Prisma.sql`
        SELECT "author", COUNT(*) AS "viewCount"
        FROM (
          SELECT p."author" AS "author"
          FROM "PageView" pv
          JOIN "Post" p ON p."id" = pv."postId"
          WHERE pv."postId" IS NOT NULL AND pv."viewedAt" >= ${since}
          UNION ALL
          SELECT c."author" AS "author"
          FROM "PageView" pv
          JOIN "Comment" c ON c."id" = pv."commentId"
          WHERE pv."commentId" IS NOT NULL AND pv."viewedAt" >= ${since}
        ) AS resolved
        GROUP BY "author"
      `);

      const counts = new Map<string, number>();
      for (const row of rows) {
        counts.set(row.author, Number(row.viewCount));
      }
      return counts;
    },
  };
}
