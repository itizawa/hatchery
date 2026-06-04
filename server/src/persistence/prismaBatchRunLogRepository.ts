import type { BatchRunLog } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { BatchRunLogRepository } from "./batchRunLogRepository.js";

export class PrismaBatchRunLogRepository implements BatchRunLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entry: Omit<BatchRunLog, "id" | "executedAt">): Promise<BatchRunLog> {
    const record = await this.prisma.batchRunLog.create({
      data: {
        status: entry.status,
        messageCount: entry.messageCount,
        errorMessage: entry.errorMessage,
        errorCode: entry.errorCode,
      },
    });
    return {
      id: record.id,
      executedAt: record.executedAt,
      status: record.status,
      messageCount: record.messageCount,
      errorMessage: record.errorMessage,
      errorCode: record.errorCode,
    };
  }

  async findRecent(limit: number): Promise<BatchRunLog[]> {
    const records = await this.prisma.batchRunLog.findMany({
      orderBy: { executedAt: "desc" },
      take: limit,
    });
    return records.map((r) => ({
      id: r.id,
      executedAt: r.executedAt,
      status: r.status,
      messageCount: r.messageCount,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    }));
  }
}
