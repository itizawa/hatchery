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

  describe("upsert", () => {
    it("新規 endpoint では新規レコードが作られる", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      const result = await repo.upsert({
        userId: "user-1",
        endpoint: "https://push.example.com/1",
        p256dh: "k1",
        auth: "a1",
      });

      expect(result.userId).toBe("user-1");
      expect(result.endpoint).toBe("https://push.example.com/1");
      expect(result.id).toBeTruthy();
    });

    it("同一 endpoint で 2 回目の upsert を呼ぶと id が変わらずフィールドが更新される", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      const first = await repo.upsert({
        userId: "user-1",
        endpoint: "https://push.example.com/1",
        p256dh: "k1",
        auth: "a1",
      });

      const second = await repo.upsert({
        userId: "user-2",
        endpoint: "https://push.example.com/1",
        p256dh: "k2",
        auth: "a2",
      });

      expect(second.id).toBe(first.id);
      expect(second.userId).toBe("user-2");
      expect(second.p256dh).toBe("k2");
      expect(second.auth).toBe("a2");

      const all = await repo.listAll();
      expect(all).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("存在する endpoint を削除できる", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });

      await repo.delete("https://push.example.com/1");

      expect(await repo.listAll()).toEqual([]);
    });

    it("存在しない endpoint を渡してもエラーにならない", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await expect(repo.delete("https://push.example.com/not-exists")).resolves.not.toThrow();
    });
  });

  describe("deleteByEndpointAndUserId", () => {
    it("endpoint は一致するが userId が異なる場合は削除されない", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });

      await repo.deleteByEndpointAndUserId({ endpoint: "https://push.example.com/1", userId: "user-2" });

      expect(await repo.listAll()).toHaveLength(1);
    });

    it("endpoint と userId の両方が一致する場合は削除される", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });

      await repo.deleteByEndpointAndUserId({ endpoint: "https://push.example.com/1", userId: "user-1" });

      expect(await repo.listAll()).toEqual([]);
    });
  });

  describe("deleteByUserId", () => {
    it("指定 userId の複数レコードが一括削除され、他ユーザーのレコードは残る", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/2", p256dh: "k2", auth: "a2" });
      await repo.upsert({ userId: "user-2", endpoint: "https://push.example.com/3", p256dh: "k3", auth: "a3" });

      await repo.deleteByUserId("user-1");

      const remaining = await repo.listAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.userId).toBe("user-2");
    });
  });

  describe("listAll", () => {
    it("全レコードを返す", async () => {
      const repo = createInMemoryPushSubscriptionRepository();
      await repo.upsert({ userId: "user-1", endpoint: "https://push.example.com/1", p256dh: "k1", auth: "a1" });
      await repo.upsert({ userId: "user-2", endpoint: "https://push.example.com/2", p256dh: "k2", auth: "a2" });

      const result = await repo.listAll();

      expect(result).toHaveLength(2);
    });
  });
});
