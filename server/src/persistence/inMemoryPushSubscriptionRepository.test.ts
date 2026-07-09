import { describe, expect, it } from "vitest";

import { createInMemoryPushSubscriptionRepository } from "./inMemoryPushSubscriptionRepository.js";

describe("createInMemoryPushSubscriptionRepository", () => {
  describe("listByUserIds（#1088）", () => {
    it("指定 userId の購読のみを返す", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });
      await repo.upsert({ userId: "user-2", endpoint: "https://push.example.com/2", p256dh: "k2", auth: "a2" });

      const result = await repo.listByUserIds(["user-1"]);

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe("user-1");
    });

    it("userIds が空配列の場合は空配列を返す", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });

      const result = await repo.listByUserIds([]);

      expect(result).toEqual([]);
    });

    it("一致する購読がない場合は空配列を返す", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      const result = await repo.listByUserIds(["not-exists"]);
      expect(result).toEqual([]);
    });
  });
});
