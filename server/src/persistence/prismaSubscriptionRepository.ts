import { Prisma, type PrismaClient } from "@prisma/client";

import type { SubscriptionRepository } from "./subscriptionRepository.js";

/** SubscriptionRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(userId: string, communityId: string): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { userId_communityId: { userId, communityId } },
      update: {},
      create: { userId, communityId },
    });
  }

  async remove(userId: string, communityId: string): Promise<void> {
    try {
      await this.prisma.subscription.delete({
        where: { userId_communityId: { userId, communityId } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return;
      }
      throw err;
    }
  }

  async listCommunityIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      select: { communityId: true },
    });
    return rows.map((r) => r.communityId);
  }

  async hasSubscription(userId: string, communityId: string): Promise<boolean> {
    const row = await this.prisma.subscription.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    return row !== null;
  }
}
