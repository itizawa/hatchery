import { Prisma, type PrismaClient } from "@prisma/client";

import type { PushSubscriptionRecord, PushSubscriptionRepository } from "./pushSubscriptionRepository.js";

/** PushSubscriptionRepository の Prisma / PostgreSQL 実装（#798）。 */
export function createPrismaPushSubscriptionRepository(prisma: PrismaClient): PushSubscriptionRepository {
  return {
    async upsert({
      userId,
      endpoint,
      p256dh,
      auth,
    }: {
      userId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }): Promise<PushSubscriptionRecord> {
      return prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { p256dh, auth },
        create: { userId, endpoint, p256dh, auth },
      });
    },

    async delete(endpoint: string): Promise<void> {
      try {
        await prisma.pushSubscription.delete({ where: { endpoint } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return;
        }
        throw err;
      }
    },

    async deleteByUserId(userId: string): Promise<void> {
      await prisma.pushSubscription.deleteMany({ where: { userId } });
    },

    async listAll(): Promise<PushSubscriptionRecord[]> {
      return prisma.pushSubscription.findMany();
    },
  };
}
