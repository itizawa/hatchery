export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}

/** push 通知購読の永続化インターフェース。 */
export interface PushSubscriptionRepository {
  upsert(data: { userId: string; endpoint: string; p256dh: string; auth: string }): Promise<PushSubscriptionRecord>;
  delete(endpoint: string): Promise<void>;
  deleteByEndpointAndUserId(data: { endpoint: string; userId: string }): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  listAll(): Promise<PushSubscriptionRecord[]>;
}
