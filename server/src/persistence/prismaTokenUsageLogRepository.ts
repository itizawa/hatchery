import type { TokenUsageLog } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { TokenUsageLogRepository, TokenUsageSummary } from "./tokenUsageLogRepository.js";

export function createPrismaTokenUsageLogRepository(prisma: PrismaClient): TokenUsageLogRepository {
  return {
    async create(entry: Omit<TokenUsageLog, "id" | "occurredAt">): Promise<TokenUsageLog> {
      const record = await prisma.tokenUsageLog.create({
        data: {
          model: entry.model,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          batchRunLogId: entry.batchRunLogId,
        },
      });
      return {
        id: record.id,
        occurredAt: record.occurredAt,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        batchRunLogId: record.batchRunLogId,
      };
    },

    async findRecent(limit: number): Promise<TokenUsageLog[]> {
      const records = await prisma.tokenUsageLog.findMany({
        orderBy: { occurredAt: "desc" },
        take: limit,
      });
      return records.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        batchRunLogId: r.batchRunLogId,
      }));
    },

    async summarize(): Promise<TokenUsageSummary> {
      const result = await prisma.tokenUsageLog.aggregate({
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      });
      const totalInputTokens = result._sum.inputTokens ?? 0;
      const totalOutputTokens = result._sum.outputTokens ?? 0;
      return {
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      };
    },
  };
}
