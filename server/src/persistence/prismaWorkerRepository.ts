import type { UpdateWorkerInput } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { CreateWorkerInput, WorkerRecord, WorkerRepository } from "./workerRepository.js";

/** Prisma の Worker 行を WorkerRecord に変換する（共通ヘルパ）。 */
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

export function createPrismaWorkerRepository(prisma: PrismaClient): WorkerRepository {
  return {
    async findById(id: string): Promise<WorkerRecord | null> {
      const row = await prisma.worker.findUnique({ where: { id, deletedAt: null } });
      if (!row) return null;
      return toRecord(row);
    },

    async update(id: string, input: UpdateWorkerInput): Promise<WorkerRecord | null> {
      try {
        const row = await prisma.worker.update({
          where: { id, deletedAt: null },
          data: {
            ...(input.displayName !== undefined && { displayName: input.displayName }),
            ...(input.role !== undefined && { role: input.role }),
            ...(input.personality !== undefined && { personality: input.personality }),
          },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async listByIds(ids: string[]): Promise<WorkerRecord[]> {
      if (ids.length === 0) return [];
      const rows = await prisma.worker.findMany({ where: { id: { in: ids }, deletedAt: null } });
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => row != null)
        .map((row) => toRecord(row));
    },

    async listBotWorkers(): Promise<WorkerRecord[]> {
      const rows = await prisma.worker.findMany({ where: { deletedAt: null } });
      return rows.map((row) => toRecord(row));
    },

    async listAllBotWorkers(): Promise<WorkerRecord[]> {
      const rows = await prisma.worker.findMany();
      return rows.map((row) => toRecord(row));
    },

    async softDelete(id: string): Promise<WorkerRecord | null> {
      try {
        const row = await prisma.worker.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async findDeletedById(id: string): Promise<WorkerRecord | null> {
      const row = await prisma.worker.findUnique({ where: { id } });
      if (!row) return null;
      return toRecord(row);
    },

    async updateImageUrl(id: string, imageUrl: string): Promise<WorkerRecord | null> {
      try {
        const row = await prisma.worker.update({
          where: { id },
          data: { imageUrl },
        });
        return toRecord(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async create(input: CreateWorkerInput): Promise<WorkerRecord> {
      const row = await prisma.worker.create({
        data: {
          id: input.id,
          displayName: input.displayName,
          role: input.role ?? null,
          personality: input.personality ?? null,
        },
      });
      return toRecord(row);
    },
  };
}
