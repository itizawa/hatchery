import type { TokenUsageLog } from "@hatchery/common";
import { calculateCostUsd } from "@hatchery/common";

/** トークン使用量の集計結果。 */
export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  /** 全期間の合計コスト（USD）。未知モデルは 0 として扱う。 */
  totalCostUsd: number;
}

/** TokenUsageLog の永続化インターフェース。 */
export interface TokenUsageLogRepository {
  /** ログエントリを保存する（id / occurredAt はリポジトリが付与）。 */
  create(entry: Omit<TokenUsageLog, "id" | "occurredAt">): Promise<TokenUsageLog>;
  /** occurredAt 降順で最大 limit 件取得する。 */
  findRecent(limit: number): Promise<TokenUsageLog[]>;
  /** 全期間のトークン使用量を集計する。 */
  summarize(): Promise<TokenUsageSummary>;
}

export function createInMemoryTokenUsageLogRepository(): TokenUsageLogRepository {
  const logs: TokenUsageLog[] = [];
  let seq = 0;

  return {
    create(entry: Omit<TokenUsageLog, "id" | "occurredAt">): Promise<TokenUsageLog> {
      const log: TokenUsageLog = {
        id: `token-log-${++seq}`,
        occurredAt: new Date(),
        ...entry,
      };
      logs.push(log);
      return Promise.resolve({ ...log });
    },

    findRecent(limit: number): Promise<TokenUsageLog[]> {
      return Promise.resolve(
        [...logs]
          // eslint-disable-next-line max-params
          .map((log, index) => ({ log, index }))
          // eslint-disable-next-line max-params
          .sort((a, b) => {
            const diff = b.log.occurredAt.getTime() - a.log.occurredAt.getTime();
            return diff !== 0 ? diff : b.index - a.index;
          })
          .slice(0, limit)
          .map(({ log }) => ({ ...log })),
      );
    },

    summarize(): Promise<TokenUsageSummary> {
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostUsd = 0;
      for (const l of logs) {
        totalInputTokens += l.inputTokens;
        totalOutputTokens += l.outputTokens;
        totalCostUsd += calculateCostUsd({ model: l.model, inputTokens: l.inputTokens, outputTokens: l.outputTokens });
      }
      return Promise.resolve({
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCostUsd,
      });
    },
  };
}
