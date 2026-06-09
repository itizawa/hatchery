import type { TokenUsageLog } from "@hatchery/common";

/** トークン使用量の集計結果。 */
export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
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

export class InMemoryTokenUsageLogRepository implements TokenUsageLogRepository {
  private readonly logs: TokenUsageLog[] = [];
  private _seq = 0;

  async create(entry: Omit<TokenUsageLog, "id" | "occurredAt">): Promise<TokenUsageLog> {
    const log: TokenUsageLog = {
      id: `token-log-${++this._seq}`,
      occurredAt: new Date(),
      ...entry,
    };
    this.logs.push(log);
    return { ...log };
  }

  async findRecent(limit: number): Promise<TokenUsageLog[]> {
    return [...this.logs]
      .map((log, index) => ({ log, index }))
      .sort((a, b) => {
        const diff = b.log.occurredAt.getTime() - a.log.occurredAt.getTime();
        return diff !== 0 ? diff : b.index - a.index;
      })
      .slice(0, limit)
      .map(({ log }) => ({ ...log }));
  }

  async summarize(): Promise<TokenUsageSummary> {
    const totalInputTokens = this.logs.reduce((sum, l) => sum + l.inputTokens, 0);
    const totalOutputTokens = this.logs.reduce((sum, l) => sum + l.outputTokens, 0);
    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
    };
  }
}
