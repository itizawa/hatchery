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
});
