import type { WorldState } from "@hatchery/common";

/**
 * WorldState（グローバルシングルトン）の永続化境界（ポート）。
 * ADR-0004 の層分離に従い、ユースケースはこのインターフェースにのみ依存する。
 */

export interface WorldStateRecord {
  id: string;
  summaryVersion: number;
  workerStates: WorldState["workerStates"];
  updatedAt: Date;
}

export interface WorldStateRepository {
  /** WorldState を取得する。存在しない場合は null を返す。 */
  get(): Promise<WorldStateRecord | null>;
  /** WorldState を upsert する（シングルトン id="singleton"）。 */
  upsert(state: Omit<WorldStateRecord, "id" | "updatedAt">): Promise<WorldStateRecord>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryWorldStateRepository(): WorldStateRepository {
  let record: WorldStateRecord | null = null;

  return {
    get(): Promise<WorldStateRecord | null> {
      return Promise.resolve(record ? { ...record } : null);
    },

    upsert(state: Omit<WorldStateRecord, "id" | "updatedAt">): Promise<WorldStateRecord> {
      record = {
        id: "singleton",
        ...state,
        updatedAt: new Date(),
      };
      return Promise.resolve({ ...record });
    },
  };
}
