import type { BatchRunLog } from "@hatchery/common";

/** BatchRunLog の永続化インターフェース。 */
export interface BatchRunLogRepository {
  /** ログエントリを保存する（id / executedAt はリポジトリが付与）。 */
  create(entry: Omit<BatchRunLog, "id" | "executedAt">): Promise<BatchRunLog>;
  /** executedAt 降順で最大 limit 件取得する。同一時刻は挿入順（新しい順）。 */
  findRecent(limit: number): Promise<BatchRunLog[]>;
}

export function createInMemoryBatchRunLogRepository(): BatchRunLogRepository {
  const logs: BatchRunLog[] = [];
  let seq = 0;

  return {
    create(entry: Omit<BatchRunLog, "id" | "executedAt">): Promise<BatchRunLog> {
      const log: BatchRunLog = {
        id: `log-${++seq}`,
        executedAt: new Date(),
        ...entry,
      };
      logs.push(log);
      return Promise.resolve({ ...log });
    },

    findRecent(limit: number): Promise<BatchRunLog[]> {
      return Promise.resolve(
        [...logs]
          .map((log, index) => ({ log, index }))
          .sort((a, b) => {
            const diff = b.log.executedAt.getTime() - a.log.executedAt.getTime();
            return diff !== 0 ? diff : b.index - a.index;
          })
          .slice(0, limit)
          .map(({ log }) => ({ ...log })),
      );
    },
  };
}
