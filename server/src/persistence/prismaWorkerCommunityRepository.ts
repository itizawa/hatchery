import type { PrismaClient } from "@prisma/client";

import type { WorkerRecord } from "./workerRepository.js";
import type { WorkerCommunityRepository } from "./workerCommunityRepository.js";

function toRecord(row: {
  id: string;
  displayName: string;
  role: string | null;
  personality: string | null;
  deletedAt: Date | null;
  imageUrl: string | null;
}): WorkerRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    personality: row.personality,
    imageUrl: row.imageUrl,
    deletedAt: row.deletedAt,
  };
}

/** WorkerCommunityRepository の Prisma / PostgreSQL 実装（#489）。 */
export function createPrismaWorkerCommunityRepository(
  prisma: PrismaClient,
): WorkerCommunityRepository {
  return {
    async listWorkersByCommunity(communityId: string): Promise<WorkerRecord[]> {
      const rows = await prisma.workerCommunity.findMany({
        where: { communityId, worker: { deletedAt: null } },
        include: { worker: true },
      });
      return rows.map((row) => toRecord(row.worker));
    },

    async listCommunityIdsByWorker(workerId: string): Promise<string[]> {
      const rows = await prisma.workerCommunity.findMany({
        where: { workerId },
        select: { communityId: true },
      });
      return rows.map((row) => row.communityId);
    },

    async setWorkerCommunities(
      workerId: string,
      communityIds: readonly string[],
    ): Promise<void> {
      const uniqueIds = [...new Set(communityIds)];
      // 既存リンク削除 → 新規一括作成をトランザクションで原子的に行う（部分適用を避ける）。
      await prisma.$transaction([
        prisma.workerCommunity.deleteMany({ where: { workerId } }),
        prisma.workerCommunity.createMany({
          data: uniqueIds.map((communityId) => ({ workerId, communityId })),
          skipDuplicates: true,
        }),
      ]);
    },
  };
}
