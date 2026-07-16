/**
 * Subscription（コミュニティ購読）の永続化境界（ポート）。ADR-0004 の層分離に従い、
 * ユースケースはこのインターフェースにのみ依存する。
 */

export interface SubscriptionRecord {
  userId: string;
  communityId: string;
  createdAt: Date;
  lastViewedAt: Date | null;
  /** コミュニティ単位の Web Push 通知 ON/OFF（#1088）。デフォルト true。 */
  notifyEnabled: boolean;
}

export interface SubscriptionWithUnreadCount {
  communityId: string;
  communitySlug: string;
  unreadCount: number;
  lastViewedAt: Date | null;
}

export interface SubscriptionRepository {
  /** 購読を追加する。既に購読済みの場合は何もしない（upsert）。 */
  add(userId: string, communityId: string): Promise<void>;
  /** 購読を解除する。存在しない場合は何もしない。 */
  remove(userId: string, communityId: string): Promise<void>;
  /** ユーザーの購読している communityId 一覧を取得する。 */
  listCommunityIdsByUser(userId: string): Promise<string[]>;
  /** ユーザーが特定の community を購読しているか確認する。 */
  hasSubscription(userId: string, communityId: string): Promise<boolean>;

  /** コミュニティ別購読者数（communityId → count）を返す（#761）。 */
  subscriberCountPerCommunity(): Promise<Map<string, number>>;

  /** lastViewedAt を更新する。未購読の場合は no-op（#933）。 */
  updateLastViewedAt({
    userId,
    communityId,
    viewedAt,
  }: {
    userId: string;
    communityId: string;
    viewedAt: Date;
  }): Promise<void>;

  /** 購読コミュニティ別の未読数を返す（#933）。 */
  listWithUnreadCounts(userId: string): Promise<SubscriptionWithUnreadCount[]>;

  /** 購読レコードを取得する。未購読の場合は null（#1088）。 */
  find({ userId, communityId }: { userId: string; communityId: string }): Promise<SubscriptionRecord | null>;

  /** notifyEnabled を更新する。未購読の場合は no-op（#1088）。 */
  updateNotifyEnabled({
    userId,
    communityId,
    notifyEnabled,
  }: {
    userId: string;
    communityId: string;
    notifyEnabled: boolean;
  }): Promise<void>;

  /** 指定 community 群のうち notifyEnabled=true の購読者 userId を重複なく返す（#1088）。 */
  listNotifiableUserIds(communityIds: string[]): Promise<string[]>;

  /** 総 subscription 数を返す（#1113・ダッシュボード集計用）。 */
  count(): Promise<number>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemorySubscriptionRepository(): SubscriptionRepository {
  const records: SubscriptionRecord[] = [];

  return {
    // eslint-disable-next-line max-params
    add(userId: string, communityId: string): Promise<void> {
      const exists = records.find((r) => r.userId === userId && r.communityId === communityId);
      if (!exists) {
        records.push({ userId, communityId, createdAt: new Date(), lastViewedAt: null, notifyEnabled: true });
      }
      return Promise.resolve();
    },

    // eslint-disable-next-line max-params
    remove(userId: string, communityId: string): Promise<void> {
      const idx = records.findIndex((r) => r.userId === userId && r.communityId === communityId);
      if (idx !== -1) {
        records.splice(idx, 1);
      }
      return Promise.resolve();
    },

    listCommunityIdsByUser(userId: string): Promise<string[]> {
      const ids = records.filter((r) => r.userId === userId).map((r) => r.communityId);
      return Promise.resolve(ids);
    },

    // eslint-disable-next-line max-params
    hasSubscription(userId: string, communityId: string): Promise<boolean> {
      const exists = records.some((r) => r.userId === userId && r.communityId === communityId);
      return Promise.resolve(exists);
    },

    subscriberCountPerCommunity(): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      for (const r of records) {
        counts.set(r.communityId, (counts.get(r.communityId) ?? 0) + 1);
      }
      return Promise.resolve(counts);
    },

    updateLastViewedAt({
      userId,
      communityId,
      viewedAt,
    }: {
      userId: string;
      communityId: string;
      viewedAt: Date;
    }): Promise<void> {
      const record = records.find((r) => r.userId === userId && r.communityId === communityId);
      if (record) {
        record.lastViewedAt = viewedAt;
      }
      return Promise.resolve();
    },

    listWithUnreadCounts(userId: string): Promise<SubscriptionWithUnreadCount[]> {
      const userRecords = records.filter((r) => r.userId === userId);
      const result = userRecords.map((r) => ({
        communityId: r.communityId,
        communitySlug: "",
        unreadCount: 0,
        lastViewedAt: r.lastViewedAt,
      }));
      return Promise.resolve(result);
    },

    find({ userId, communityId }: { userId: string; communityId: string }): Promise<SubscriptionRecord | null> {
      const record = records.find((r) => r.userId === userId && r.communityId === communityId);
      return Promise.resolve(record ?? null);
    },

    updateNotifyEnabled({
      userId,
      communityId,
      notifyEnabled,
    }: {
      userId: string;
      communityId: string;
      notifyEnabled: boolean;
    }): Promise<void> {
      const record = records.find((r) => r.userId === userId && r.communityId === communityId);
      if (record) {
        record.notifyEnabled = notifyEnabled;
      }
      return Promise.resolve();
    },

    listNotifiableUserIds(communityIds: string[]): Promise<string[]> {
      const ids = new Set(
        records
          .filter((r) => communityIds.includes(r.communityId) && r.notifyEnabled)
          .map((r) => r.userId),
      );
      return Promise.resolve([...ids]);
    },

    count(): Promise<number> {
      return Promise.resolve(records.length);
    },
  };
}
