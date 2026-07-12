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
    // eslint-disable-next-line max-params
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

    // eslint-disable-next-line max-params
    async recordCommentViews(
      commentIds: string[],
      sessionId: string,
      userId: string | null,
    ): Promise<{ newCount: number }> {
      if (commentIds.length === 0) return { newCount: 0 };
      return prisma.$transaction(async (tx) => {
        // createMany の前に既存行を取得しておき、新規挿入分だけを正確に特定する。
        // createMany 後の findMany は既存行も含むため over-count を引き起こす（#665）。
        const preExisting = await tx.pageView.findMany({
          where: { commentId: { in: commentIds }, sessionId },
          select: { commentId: true },
        });
        const preExistingIds = new Set(
          preExisting.map((r) => r.commentId).filter((id): id is string => id !== null),
        );

        await tx.pageView.createMany({
          data: commentIds.map((commentId) => ({ commentId, sessionId, userId })),
          skipDuplicates: true,
        });

        const newCommentIds = commentIds.filter((id) => !preExistingIds.has(id));
        const newCount = newCommentIds.length;
        if (newCount > 0) {
          await tx.comment.updateMany({
            where: { id: { in: newCommentIds } },
            data: { viewCount: { increment: 1 } },
          });
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

    async totalViewCount(): Promise<number> {
      // ADR-0032 の方針どおり、全期間表示は windowed 集計（PageView raw 行）を回さず
      // Post.viewCount / Comment.viewCount の累積カウンタを直接読む。
      const [postAgg, commentAgg] = await Promise.all([
        prisma.post.aggregate({ _sum: { viewCount: true } }),
        prisma.comment.aggregate({ _sum: { viewCount: true } }),
      ]);
      return (postAgg._sum.viewCount ?? 0) + (commentAgg._sum.viewCount ?? 0);
    },

    async viewCountByCommunity(): Promise<Map<string, number>> {
      // Post.viewCount / Comment.viewCount カラムを communityId で UNION ALL → GROUP BY する
      // （viewsByWorkerSince と同じ raw SQL の作法。ただし集計元は PageView ではなく viewCount カラム）。
      const rows = await prisma.$queryRaw<{ communityId: string; totalViews: bigint }[]>(Prisma.sql`
        SELECT "communityId", SUM("viewCount") AS "totalViews"
        FROM (
          SELECT "communityId", "viewCount" FROM "Post"
          UNION ALL
          SELECT "communityId", "viewCount" FROM "Comment"
        ) AS resolved
        GROUP BY "communityId"
      `);

      const counts = new Map<string, number>();
      for (const row of rows) {
        counts.set(row.communityId, Number(row.totalViews));
      }
      return counts;
    },
  };
}
