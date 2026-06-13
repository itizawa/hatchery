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

  /**
   * 指定ワーカーが参加する community の id 一覧を返す（#490・管理画面の編集 UI 用）。
   * 順序は問わない。紐づきが無い場合は空配列。
   */
  listCommunityIdsByWorker(workerId: string): Promise<string[]>;

  /**
   * 指定ワーカーの参加コミュニティを communityIds で全置換する（#490・set セマンティクス）。
   * 既存の紐づきを削除し communityIds で再構築する。重複 id は一意化する。冪等。
   */
  setWorkerCommunities(workerId: string, communityIds: readonly string[]): Promise<void>;
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

    listCommunityIdsByWorker(workerId: string): Promise<string[]> {
      const result = links
        .filter((l) => l.workerId === workerId)
        .map((l) => l.communityId);
      return Promise.resolve(result);
    },

    setWorkerCommunities(
      workerId: string,
      communityIds: readonly string[],
    ): Promise<void> {
      // 既存リンクを全削除（対象 worker のみ）してから一意化した id で再構築する。
      for (let i = links.length - 1; i >= 0; i--) {
        if (links[i]!.workerId === workerId) {
          links.splice(i, 1);
        }
      }
      for (const communityId of new Set(communityIds)) {
        links.push({ workerId, communityId });
      }
      return Promise.resolve();
    },
  };
}
