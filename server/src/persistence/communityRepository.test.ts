import { describe, expect, it } from "vitest";
import { createInMemoryCommunityRepository } from "./communityRepository.js";

const makeCommunity = (overrides: Partial<Parameters<typeof createInMemoryCommunityRepository>[0][0]> = {}) => ({
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("createInMemoryCommunityRepository", () => {
  describe("findById", () => {
    it("存在する id で取得できる", async () => {
      const community = makeCommunity();
      const repo = createInMemoryCommunityRepository([community]);
      const result = await repo.findById("community-1");
      expect(result).toMatchObject({ id: "community-1", slug: "technology" });
    });

    it("存在しない id は null を返す", async () => {
      const repo = createInMemoryCommunityRepository([]);
      const result = await repo.findById("not-exists");
      expect(result).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("存在する slug で取得できる", async () => {
      const community = makeCommunity();
      const repo = createInMemoryCommunityRepository([community]);
      const result = await repo.findBySlug("technology");
      expect(result).toMatchObject({ id: "community-1", slug: "technology" });
    });

    it("存在しない slug は null を返す", async () => {
      const repo = createInMemoryCommunityRepository([]);
      const result = await repo.findBySlug("not-exists");
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("全コミュニティを createdAt 昇順で返す", async () => {
      const communities = [
        makeCommunity({ id: "c2", slug: "daily", createdAt: new Date("2026-01-02") }),
        makeCommunity({ id: "c1", slug: "technology", createdAt: new Date("2026-01-01") }),
      ];
      const repo = createInMemoryCommunityRepository(communities);
      const result = await repo.list();
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("technology");
      expect(result[1].slug).toBe("daily");
    });

    it("空の場合は空配列を返す", async () => {
      const repo = createInMemoryCommunityRepository([]);
      const result = await repo.list();
      expect(result).toEqual([]);
    });
  });
});
