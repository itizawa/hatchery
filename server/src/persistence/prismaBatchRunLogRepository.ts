import { BatchRunLogStatusSchema, type BatchRunLogRecord } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { BatchRunLogInput, BatchRunLogRepository } from "./batchRunLogRepository.js";

function toRecord(row: {
  id: string;
  executedAt: Date;
  status: string;
  messageCount: number | null;
  errorMessage: string | null;
  errorCode: string | null;
}): BatchRunLogRecord {
  return {
    id: row.id,
    executedAt: row.executedAt,
    status: BatchRunLogStatusSchema.parse(row.status),
    messageCount: row.messageCount,
    errorMessage: row.errorMessage,
    errorCode: row.errorCode,
  };
}

/** BatchRunLogRepository の Prisma / PostgreSQL 実装（#75）。 */
export class PrismaBatchRunLogRepository implements BatchRunLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: BatchRunLogInput): Promise<BatchRunLogRecord> {
    const row = await this.prisma.batchRunLog.create({
      data: {
        status: input.status,
        messageCount: input.messageCount ?? null,
        errorMessage: input.errorMessage ?? null,
        errorCode: input.errorCode ?? null,
      },
    });
    return toRecord(row);
  }

  async listRecent(limit: number): Promise<BatchRunLogRecord[]> {
    const rows = await this.prisma.batchRunLog.findMany({
      orderBy: { executedAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }
}
