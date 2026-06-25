import type { PushSubscriptionRecord, PushSubscriptionRepository } from "./pushSubscriptionRepository.js";

export function createInMemoryPushSubscriptionRepository(): PushSubscriptionRepository {
  const store = new Map<string, PushSubscriptionRecord>();
  let idCounter = 0;

  return {
    async upsert({ userId, endpoint, p256dh, auth }) {
      const existing = [...store.values()].find((r) => r.endpoint === endpoint);
      if (existing) {
        const updated = { ...existing, p256dh, auth };
        store.set(existing.id, updated);
        return updated;
      }
      const record: PushSubscriptionRecord = {
        id: `push-${++idCounter}`,
        userId,
        endpoint,
        p256dh,
        auth,
        createdAt: new Date(),
      };
      store.set(record.id, record);
      return record;
    },
    async delete(endpoint) {
      const found = [...store.values()].find((r) => r.endpoint === endpoint);
      if (found) store.delete(found.id);
    },
    async deleteByEndpointAndUserId({ endpoint, userId }: { endpoint: string; userId: string }) {
      const found = [...store.values()].find((r) => r.endpoint === endpoint && r.userId === userId);
      if (found) store.delete(found.id);
    },
    async deleteByUserId(userId) {
      for (const [id, r] of store.entries()) {
        if (r.userId === userId) store.delete(id);
      }
    },
    async listAll() {
      return [...store.values()];
    },
  };
}
