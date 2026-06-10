import type { PrismaClient } from "@prisma/client";
import type { WorldState } from "@hatchery/common";

import type { WorldStateRecord, WorldStateRepository } from "./worldStateRepository.js";

function toRecord(row: {
  id: string;
  summaryVersion: number;
  workerStates: unknown;
  updatedAt: Date;
}): WorldStateRecord {
  return {
    id: row.id,
    summaryVersion: row.summaryVersion,
    workerStates: (row.workerStates ?? {}) as WorldState["workerStates"],
    updatedAt: row.updatedAt,
  };
}

/** WorldStateRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaWorldStateRepository(prisma: PrismaClient): WorldStateRepository {
  return {
    async get(): Promise<WorldStateRecord | null> {
      const row = await prisma.worldState.findUnique({ where: { id: "singleton" } });
      return row ? toRecord(row) : null;
    },

    async upsert(state: Omit<WorldStateRecord, "id" | "updatedAt">): Promise<WorldStateRecord> {
      const row = await prisma.worldState.upsert({
        where: { id: "singleton" },
        update: {
          summaryVersion: state.summaryVersion,
          workerStates: state.workerStates,
        },
        create: {
          id: "singleton",
          summaryVersion: state.summaryVersion,
          workerStates: state.workerStates,
        },
      });
      return toRecord(row);
    },
  };
}
