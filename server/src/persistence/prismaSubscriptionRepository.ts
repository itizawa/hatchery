import { Prisma, type PrismaClient } from "@prisma/client";

import type { SubscriptionRepository, SubscriptionWithUnreadCount } from "./subscriptionRepository.js";

/** SubscriptionRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaSubscriptionRepository(prisma: PrismaClient): SubscriptionRepository {
  return {
    // eslint-disable-next-line max-params
    async add(userId: string, communityId: string): Promise<void> {
      await prisma.subscription.upsert({
        where: { userId_communityId: { userId, communityId } },
        update: {},
        create: { userId, communityId },
      });
    },

    // eslint-disable-next-line max-params
    async remove(userId: string, communityId: string): Promise<void> {
      try {
        await prisma.subscription.delete({
          where: { userId_communityId: { userId, communityId } },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return;
        }
        throw err;
      }
    },

    async listCommunityIdsByUser(userId: string): Promise<string[]> {
      const rows = await prisma.subscription.findMany({
        where: { userId },
        select: { communityId: true },
      });
      return rows.map((r) => r.communityId);
    },

    // eslint-disable-next-line max-params
    async hasSubscription(userId: string, communityId: string): Promise<boolean> {
      const row = await prisma.subscription.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });
      return row !== null;
    },

    async subscriberCountPerCommunity(): Promise<Map<string, number>> {
      const rows = await prisma.subscription.groupBy({
        by: ["communityId"],
        _count: { userId: true },
      });
      const counts = new Map<string, number>();
      for (const row of rows) {
        counts.set(row.communityId, row._count.userId);
      }
      return counts;
    },

    async updateLastViewedAt({
      userId,
      communityId,
      viewedAt,
    }: {
      userId: string;
      communityId: string;
      viewedAt: Date;
    }): Promise<void> {
      try {
        await prisma.subscription.update({
          where: { userId_communityId: { userId, communityId } },
          data: { lastViewedAt: viewedAt },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return;
        }
        throw err;
      }
    },

    async listWithUnreadCounts(userId: string): Promise<SubscriptionWithUnreadCount[]> {
      const subs = await prisma.subscription.findMany({
        where: { userId },
        include: { community: { select: { slug: true } } },
      });
      const results = await Promise.all(
        subs.map(async (sub) => {
          const unreadCount = await prisma.post.count({
            where: {
              communityId: sub.communityId,
              ...(sub.lastViewedAt ? { createdAt: { gt: sub.lastViewedAt } } : {}),
            },
          });
          return {
            communityId: sub.communityId,
            communitySlug: sub.community.slug,
            unreadCount,
          };
        }),
      );
      return results;
    },
  };
}
