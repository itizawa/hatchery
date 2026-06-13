import type { WorkerRecord } from "./workerRepository.js";

/**
 * WorkerCommunity（worker ↔ community 参加）の永続化境界（ポート）（#489）。
 * 定時バッチは community ごとの登場ワーカーをこのポート経由で DB から取得する。
 * ADR-0004 の層分離・ADR-0024 の関数ファクトリ規約に従い、具体実装を注入する。
 */
export interface WorkerCommunityRepository {
  /**
   * community に紐づく有効な（論理削除されていない）ワーカーを返す。
   * 紐づきが無い場合は空配列。
   */
  listWorkersByCommunity(communityId: string): Promise<WorkerRecord[]>;
}

/** InMemory 実装の初期データ（テスト用注入）。 */
export interface InMemoryWorkerCommunityData {
  /** 既知のワーカー（id でリンクと突き合わせる）。 */
  workers: readonly WorkerRecord[];
  /** worker ↔ community の紐づき。 */
  links: readonly { workerId: string; communityId: string }[];
}

/** DB 非依存のインメモリ実装。ユースケース/バッチのテストで注入する。 */
export function createInMemoryWorkerCommunityRepository(
  data: InMemoryWorkerCommunityData = { workers: [], links: [] },
): WorkerCommunityRepository {
  const workersById = new Map(data.workers.map((w) => [w.id, w]));
  const links = data.links.map((l) => ({ ...l }));

  return {
    listWorkersByCommunity(communityId: string): Promise<WorkerRecord[]> {
      const result = links
        .filter((l) => l.communityId === communityId)
        .map((l) => workersById.get(l.workerId))
        .filter((w): w is WorkerRecord => w != null && w.deletedAt === null)
        .map((w) => ({ ...w }));
      return Promise.resolve(result);
    },
  };
}
