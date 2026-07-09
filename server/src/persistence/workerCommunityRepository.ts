import type { WorkerRecord } from "./workerRepository.js";

/** listWorkersByCommunity の引数（#720 の関数引数規約に従いオブジェクト引数にする・#1078）。 */
export interface ListWorkersByCommunityOptions {
  communityId: string;
  /**
   * 1 ページあたりの取得件数。省略時はページネーションをかけず、
   * 紐づく有効なワーカーを全件 `nextCursor: null` で返す（バッチ用途の後方互換・#1078）。
   */
  limit?: number;
  /** 直前ページの nextCursor（#1078）。省略時は先頭ページから取得する。 */
  cursor?: string;
}

/** listWorkersByCommunity の戻り値（カーソルページネーション形式・#1078）。 */
export interface ListWorkersByCommunityResult {
  items: WorkerRecord[];
  /** 次ページ取得用カーソル。null の場合は末尾（またはページネーションなし）。 */
  nextCursor: string | null;
}

/**
 * WorkerCommunity（worker ↔ community 参加）の永続化境界（ポート）（#489）。
 * 定時バッチは community ごとの登場ワーカーをこのポート経由で DB から取得する。
 * ADR-0004 の層分離・ADR-0024 の関数ファクトリ規約に従い、具体実装を注入する。
 */
export interface WorkerCommunityRepository {
  /**
   * community に紐づく有効な（論理削除されていない）ワーカーを id 昇順で返す（#1078 カーソルページネーション対応）。
   * `limit` を渡すとカーソルページネーションし、省略すると全件を `nextCursor: null` で返す。
   * 紐づきが無い場合は `items: []`。不正な `cursor` を渡すと `INVALID_CURSOR` エラーで reject する。
   */
  listWorkersByCommunity(
    options: ListWorkersByCommunityOptions,
  ): Promise<ListWorkersByCommunityResult>;

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

  /**
   * 指定コミュニティに所属する有効な（論理削除されていない）ワーカーの id/displayName を
   * id 昇順で返す（#1079・コミュニティ起点の管理画面編集 UI 用）。紐づきが無い場合は空配列。
   */
  listWorkerSummariesByCommunity(
    communityId: string,
  ): Promise<{ id: string; displayName: string }[]>;

  /**
   * 指定コミュニティの所属ワーカーを workerIds で全置換する（#1079・set セマンティクス）。
   * 既存の紐づきを削除し workerIds で再構築する。重複 id は一意化する。冪等。
   */
  setCommunityWorkers(communityId: string, workerIds: readonly string[]): Promise<void>;
}

/** InMemory 実装の初期データ（テスト用注入）。 */
export interface InMemoryWorkerCommunityData {
  /** 既知のワーカー（id でリンクと突き合わせる）。 */
  workers: readonly WorkerRecord[];
  /** worker ↔ community の紐づき。 */
  links: readonly { workerId: string; communityId: string }[];
}

interface WorkerCursorPayload {
  id: string;
}

/** listWorkersByCommunity のカーソルをエンコードする（base64(JSON{id})・#1078）。 */
export function encodeWorkerCursor(record: Pick<WorkerRecord, "id">): string {
  const payload: WorkerCursorPayload = { id: record.id };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/** listWorkersByCommunity のカーソルをデコードする。不正な形式は null を返す（#1078）。 */
export function decodeWorkerCursor(cursor: string): WorkerCursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as WorkerCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** id の昇順比較関数。 */
// eslint-disable-next-line max-params
function compareById(a: Pick<WorkerRecord, "id">, b: Pick<WorkerRecord, "id">): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** DB 非依存のインメモリ実装。ユースケース/バッチのテストで注入する。 */
export function createInMemoryWorkerCommunityRepository(
  data: InMemoryWorkerCommunityData = { workers: [], links: [] },
): WorkerCommunityRepository {
  const workersById = new Map(data.workers.map((w) => [w.id, w]));
  const links = data.links.map((l) => ({ ...l }));

  return {
    listWorkersByCommunity({
      communityId,
      limit,
      cursor,
    }: ListWorkersByCommunityOptions): Promise<ListWorkersByCommunityResult> {
      let cursorPayload: WorkerCursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodeWorkerCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const sorted = links
        .filter((l) => l.communityId === communityId)
        .map((l) => workersById.get(l.workerId))
        .filter((w): w is WorkerRecord => w != null && w.deletedAt === null)
        .sort(compareById);

      const filtered = cursorPayload
        ? sorted.filter((w) => w.id > cursorPayload!.id)
        : sorted;

      if (limit === undefined) {
        return Promise.resolve({ items: filtered.map((w) => ({ ...w })), nextCursor: null });
      }

      const fetched = filtered.slice(0, limit + 1);
      const hasMore = fetched.length > limit;
      const items = hasMore ? fetched.slice(0, limit) : fetched;
      const last = items.at(-1);
      const nextCursor = hasMore && last ? encodeWorkerCursor(last) : null;

      return Promise.resolve({ items: items.map((w) => ({ ...w })), nextCursor });
    },

    listCommunityIdsByWorker(workerId: string): Promise<string[]> {
      const result = links
        .filter((l) => l.workerId === workerId)
        .map((l) => l.communityId);
      return Promise.resolve(result);
    },

    // eslint-disable-next-line max-params
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

    listWorkerSummariesByCommunity(
      communityId: string,
    ): Promise<{ id: string; displayName: string }[]> {
      const result = links
        .filter((l) => l.communityId === communityId)
        .map((l) => workersById.get(l.workerId))
        .filter((w): w is WorkerRecord => w != null && w.deletedAt === null)
        .sort(compareById)
        .map((w) => ({ id: w.id, displayName: w.displayName }));
      return Promise.resolve(result);
    },

    // eslint-disable-next-line max-params
    setCommunityWorkers(
      communityId: string,
      workerIds: readonly string[],
    ): Promise<void> {
      // 既存リンクを全削除（対象 community のみ）してから一意化した id で再構築する。
      for (let i = links.length - 1; i >= 0; i--) {
        if (links[i]!.communityId === communityId) {
          links.splice(i, 1);
        }
      }
      for (const workerId of new Set(workerIds)) {
        links.push({ workerId, communityId });
      }
      return Promise.resolve();
    },
  };
}
