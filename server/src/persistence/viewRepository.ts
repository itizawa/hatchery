/**
 * View（PageView）の永続化境界（ポート）。ADR-0032 で導入。
 * 1 セッション × 1 ターゲット（post または comment）につき 1 レコードを維持する
 *（DB では (postId, sessionId) / (commentId, sessionId) の複合ユニークで担保）。
 * 同一セッションの再閲覧は no-op（isNew=false / newCount=0）。
 */

export type ViewTargetType = "post" | "comment";

export interface ViewRepository {
  /**
   * post 閲覧を記録する。
   * - 新規（sessionId 初出）→ create, isNew=true
   * - 既存（同 sessionId）→ no-op, isNew=false
   */
  recordPostView(postId: string, sessionId: string, userId: string | null): Promise<{ isNew: boolean }>;
  /**
   * コメント閲覧をバッチ記録する。
   * - 新規 commentId × sessionId → create
   * - 既存は skip（skipDuplicates / no-op）
   * - newCount: 新規挿入された件数
   */
  recordCommentViews(commentIds: string[], sessionId: string, userId: string | null): Promise<{ newCount: number }>;
  /**
   * 直近の閲覧記録から worker（post/comment の author）別の閲覧数を集計する（#665 / ADR-0032）。
   * ランキング画面の閲覧数表示に使う。
   *
   * @param since この日時以降（`viewedAt >= since`）の記録のみ集計する。
   * @returns workerId → 閲覧数の Map。集計対象が無い worker はキーを持たない。
   */
  viewsByWorkerSince(since: Date): Promise<Map<string, number>>;
  /**
   * 全期間の累計閲覧数（Post + Comment の viewCount 合計）を返す（#1113・ダッシュボード集計用）。
   * ADR-0032 の方針どおり、windowed 集計ではなく全期間の累計カウンタを読む。
   */
  totalViewCount(): Promise<number>;
  /**
   * community 別の累計閲覧数を返す（#1113・ダッシュボード集計用）。Post 経由で communityId に解決し集計する。
   * 閲覧記録の無い community はキーを持たない（呼び出し元で 0 件扱いにする）。
   */
  viewCountByCommunity(): Promise<Map<string, number>>;
}

/**
 * viewedAt を id に解決する関数（インメモリ実装用）。
 * targetType と targetId から author（workerId）を返す。解決できない場合は null。
 */
// eslint-disable-next-line max-params
export type ResolveViewAuthor = (
  targetType: ViewTargetType,
  targetId: string,
) => string | null;

/**
 * targetType / targetId から community を解決する関数（インメモリ実装用・#1113）。
 * `viewCountByCommunity` で targetId → communityId を解決するために使う。解決できない場合は null。
 */
// eslint-disable-next-line max-params
export type ResolveViewCommunity = (
  targetType: ViewTargetType,
  targetId: string,
) => string | null;

export interface CreateInMemoryViewRepositoryOptions {
  /** `viewsByWorkerSince` で targetId → workerId を解決する関数。省略時は全ターゲットが解決不能（閲覧数集計は常に空）になる。 */
  resolveAuthor?: ResolveViewAuthor;
  /** `viewedAt` に使う現在時刻供給関数（テストで固定するため）。既定は `() => new Date()`。 */
  clock?: () => Date;
  /** `viewCountByCommunity` で targetId → communityId を解決する関数（#1113）。省略時は全ターゲットが解決不能（community 別集計は常に空）になる。 */
  resolveCommunity?: ResolveViewCommunity;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryViewRepository({
  resolveAuthor,
  clock = () => new Date(),
  resolveCommunity,
}: CreateInMemoryViewRepositoryOptions = {}): ViewRepository {
  // dedup キー: "post:postId:sessionId" or "comment:commentId:sessionId"
  const seen = new Set<string>();
  interface ViewRecord {
    targetType: ViewTargetType;
    targetId: string;
    sessionId: string;
    viewedAt: Date;
  }
  const records: ViewRecord[] = [];

  // eslint-disable-next-line max-params
  function postKey(postId: string, sessionId: string): string {
    return `post:${postId}:${sessionId}`;
  }
  // eslint-disable-next-line max-params
  function commentKey(commentId: string, sessionId: string): string {
    return `comment:${commentId}:${sessionId}`;
  }

  return {
    // eslint-disable-next-line max-params
    recordPostView(
      postId: string,
      sessionId: string,
    ): Promise<{ isNew: boolean }> {
      const key = postKey(postId, sessionId);
      if (seen.has(key)) return Promise.resolve({ isNew: false });
      seen.add(key);
      records.push({ targetType: "post", targetId: postId, sessionId, viewedAt: clock() });
      return Promise.resolve({ isNew: true });
    },

    // eslint-disable-next-line max-params
    recordCommentViews(
      commentIds: string[],
      sessionId: string,
    ): Promise<{ newCount: number }> {
      let newCount = 0;
      for (const commentId of commentIds) {
        const key = commentKey(commentId, sessionId);
        if (!seen.has(key)) {
          seen.add(key);
          records.push({ targetType: "comment", targetId: commentId, sessionId, viewedAt: clock() });
          newCount++;
        }
      }
      return Promise.resolve({ newCount });
    },

    viewsByWorkerSince(since: Date): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      for (const record of records) {
        if (record.viewedAt.getTime() < since.getTime()) continue;
        const workerId = resolveAuthor?.(record.targetType, record.targetId) ?? null;
        if (workerId === null) continue;
        counts.set(workerId, (counts.get(workerId) ?? 0) + 1);
      }
      return Promise.resolve(counts);
    },

    totalViewCount(): Promise<number> {
      // 各 record は dedup 済みの新規閲覧イベント 1 件を表し、本番（Prisma）の
      // viewCount インクリメント 1 回に対応する。そのため件数の総和がそのまま累計閲覧数になる。
      return Promise.resolve(records.length);
    },

    viewCountByCommunity(): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      for (const record of records) {
        const communityId = resolveCommunity?.(record.targetType, record.targetId) ?? null;
        if (communityId === null) continue;
        counts.set(communityId, (counts.get(communityId) ?? 0) + 1);
      }
      return Promise.resolve(counts);
    },
  };
}
