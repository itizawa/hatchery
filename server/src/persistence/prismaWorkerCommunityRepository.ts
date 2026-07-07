import type { PrismaClient } from "@prisma/client";

import type { WorkerRecord } from "./workerRepository.js";
import {
  decodeWorkerCursor,
  encodeWorkerCursor,
  type ListWorkersByCommunityOptions,
  type ListWorkersByCommunityResult,
  type WorkerCommunityRepository,
} from "./workerCommunityRepository.js";

function toRecord(row: {
  id: string;
  displayName: string;
  role: string | null;
  personality: string | null;
  verbosity: string;
  deletedAt: Date | null;
  imageUrl: string | null;
}): WorkerRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    personality: row.personality,
    verbosity: row.verbosity,
    imageUrl: row.imageUrl,
    deletedAt: row.deletedAt,
  };
}

/** WorkerCommunityRepository の Prisma / PostgreSQL 実装（#489）。 */
export function createPrismaWorkerCommunityRepository(
  prisma: PrismaClient,
): WorkerCommunityRepository {
  return {
    async listWorkersByCommunity({
      communityId,
      limit,
      cursor,
    }: ListWorkersByCommunityOptions): Promise<ListWorkersByCommunityResult> {
      let cursorId: string | undefined;
      if (cursor !== undefined) {
        const payload = decodeWorkerCursor(cursor);
        if (!payload) throw new Error("INVALID_CURSOR");
        cursorId = payload.id;
      }

      const rows = await prisma.workerCommunity.findMany({
        where: {
          communityId,
          worker: { deletedAt: null },
          ...(cursorId !== undefined ? { workerId: { gt: cursorId } } : {}),
        },
        include: { worker: true },
        orderBy: { workerId: "asc" },
        ...(limit !== undefined ? { take: limit + 1 } : {}),
      });

      if (limit === undefined) {
        return { items: rows.map((row) => toRecord(row.worker)), nextCursor: null };
      }

      const hasMore = rows.length > limit;
      const sliced = hasMore ? rows.slice(0, limit) : rows;
      const items = sliced.map((row) => toRecord(row.worker));
      const lastWorker = sliced.at(-1)?.worker;
      const nextCursor = hasMore && lastWorker ? encodeWorkerCursor(lastWorker) : null;

      return { items, nextCursor };
    },

    async listCommunityIdsByWorker(workerId: string): Promise<string[]> {
      const rows = await prisma.workerCommunity.findMany({
        where: { workerId },
        select: { communityId: true },
      });
      return rows.map((row) => row.communityId);
    },

    // eslint-disable-next-line max-params
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

    async listWorkerSummariesByCommunity(
      communityId: string,
    ): Promise<{ id: string; displayName: string }[]> {
      const rows = await prisma.workerCommunity.findMany({
        where: { communityId, worker: { deletedAt: null } },
        include: { worker: { select: { id: true, displayName: true } } },
        orderBy: { workerId: "asc" },
      });
      return rows.map((row) => ({ id: row.worker.id, displayName: row.worker.displayName }));
    },

    // eslint-disable-next-line max-params
    async setCommunityWorkers(
      communityId: string,
      workerIds: readonly string[],
    ): Promise<void> {
      const uniqueIds = [...new Set(workerIds)];
      // 既存リンク削除 → 新規一括作成をトランザクションで原子的に行う（部分適用を避ける）。
      await prisma.$transaction([
        prisma.workerCommunity.deleteMany({ where: { communityId } }),
        prisma.workerCommunity.createMany({
          data: uniqueIds.map((workerId) => ({ workerId, communityId })),
          skipDuplicates: true,
        }),
      ]);
    },
  };
}
