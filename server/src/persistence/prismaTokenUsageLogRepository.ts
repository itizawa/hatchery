import type { TokenUsageLog } from "@hatchery/common";
import { calculateCostUsd } from "@hatchery/common";
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
      // groupBy(model) で 1 クエリでモデル別集計し、単価テーブルで $ 換算する。
      const grouped = await prisma.tokenUsageLog.groupBy({
        by: ["model"],
        _sum: { inputTokens: true, outputTokens: true },
      });
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostUsd = 0;
      for (const g of grouped) {
        const inp = g._sum.inputTokens ?? 0;
        const out = g._sum.outputTokens ?? 0;
        totalInputTokens += inp;
        totalOutputTokens += out;
        totalCostUsd += calculateCostUsd({ model: g.model, inputTokens: inp, outputTokens: out });
      }
      return {
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCostUsd,
      };
    },
  };
}
