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
  };
}
