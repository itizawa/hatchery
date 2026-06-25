import { describe, expect, it } from "vitest";
import { createInMemorySubscriptionRepository } from "./subscriptionRepository.js";

describe("createInMemorySubscriptionRepository", () => {
  describe("add", () => {
    it("購読を追加できる", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      const ids = await repo.listCommunityIdsByUser("user-1");
      expect(ids).toContain("community-1");
    });

    it("既に購読済みの場合は重複しない（upsert）", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      await repo.add("user-1", "community-1");
      const ids = await repo.listCommunityIdsByUser("user-1");
      expect(ids).toHaveLength(1);
    });
  });

  describe("remove", () => {
    it("購読を解除できる", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      await repo.remove("user-1", "community-1");
      const ids = await repo.listCommunityIdsByUser("user-1");
      expect(ids).toHaveLength(0);
    });

    it("存在しない購読の解除は何もしない", async () => {
      const repo = createInMemorySubscriptionRepository();
      await expect(repo.remove("user-1", "not-exists")).resolves.toBeUndefined();
    });
  });

  describe("listCommunityIdsByUser", () => {
    it("ユーザーの購読コミュニティ一覧を返す", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      await repo.add("user-1", "community-2");
      await repo.add("user-2", "community-3"); // 他のユーザーは含めない
      const ids = await repo.listCommunityIdsByUser("user-1");
      expect(ids).toHaveLength(2);
      expect(ids).toContain("community-1");
      expect(ids).toContain("community-2");
      expect(ids).not.toContain("community-3");
    });
  });

  describe("hasSubscription", () => {
    it("購読済みの場合 true を返す", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      const result = await repo.hasSubscription("user-1", "community-1");
      expect(result).toBe(true);
    });

    it("未購読の場合 false を返す", async () => {
      const repo = createInMemorySubscriptionRepository();
      const result = await repo.hasSubscription("user-1", "not-subscribed");
      expect(result).toBe(false);
    });
  });

  describe("updateLastViewedAt", () => {
    it("購読済みの場合 lastViewedAt を更新できる", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      const viewedAt = new Date("2026-01-01T12:00:00Z");
      await expect(
        repo.updateLastViewedAt({ userId: "user-1", communityId: "community-1", viewedAt }),
      ).resolves.toBeUndefined();
    });

    it("未購読（存在しない Subscription）に対しては no-op（エラーなし）", async () => {
      const repo = createInMemorySubscriptionRepository();
      const viewedAt = new Date("2026-01-01T12:00:00Z");
      await expect(
        repo.updateLastViewedAt({ userId: "user-1", communityId: "not-subscribed", viewedAt }),
      ).resolves.toBeUndefined();
    });
  });

  describe("listWithUnreadCounts", () => {
    it("購読なしの場合は空配列を返す", async () => {
      const repo = createInMemorySubscriptionRepository();
      const result = await repo.listWithUnreadCounts("user-1");
      expect(result).toEqual([]);
    });

    it("購読済みのコミュニティを返す（インメモリ実装は unreadCount: 0 固定）", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      const result = await repo.listWithUnreadCounts("user-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        communityId: "community-1",
        communitySlug: "",
        unreadCount: 0,
      });
    });

    it("他のユーザーの購読は含まない", async () => {
      const repo = createInMemorySubscriptionRepository();
      await repo.add("user-1", "community-1");
      await repo.add("user-2", "community-2");
      const result = await repo.listWithUnreadCounts("user-1");
      expect(result).toHaveLength(1);
      expect(result[0].communityId).toBe("community-1");
    });
  });
});
