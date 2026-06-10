/**
 * Subscription（コミュニティ購読）の永続化境界（ポート）。ADR-0004 の層分離に従い、
 * ユースケースはこのインターフェースにのみ依存する。
 */

export interface SubscriptionRecord {
  userId: string;
  communityId: string;
  createdAt: Date;
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
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemorySubscriptionRepository(): SubscriptionRepository {
  const records: SubscriptionRecord[] = [];

  return {
    add(userId: string, communityId: string): Promise<void> {
      const exists = records.find((r) => r.userId === userId && r.communityId === communityId);
      if (!exists) {
        records.push({ userId, communityId, createdAt: new Date() });
      }
      return Promise.resolve();
    },

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

    hasSubscription(userId: string, communityId: string): Promise<boolean> {
      const exists = records.some((r) => r.userId === userId && r.communityId === communityId);
      return Promise.resolve(exists);
    },
  };
}
