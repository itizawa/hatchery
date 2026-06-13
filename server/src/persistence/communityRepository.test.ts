import { describe, expect, it } from "vitest";
import { createInMemoryCommunityRepository } from "./communityRepository.js";

const makeCommunity = (overrides: Partial<Parameters<typeof createInMemoryCommunityRepository>[0][0]> = {}) => ({
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
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

  describe("create（#457）", () => {
    it("新規作成時は iconUrl / coverUrl が null になる", async () => {
      const repo = createInMemoryCommunityRepository([]);
      const created = await repo.create({ slug: "new", name: "New", description: "説明" });
      expect(created.iconUrl).toBeNull();
      expect(created.coverUrl).toBeNull();
    });
  });

  describe("update（#457 画像 URL の永続化）", () => {
    it("iconUrl を更新できる", async () => {
      const repo = createInMemoryCommunityRepository([makeCommunity()]);
      const updated = await repo.update("community-1", {
        iconUrl: "https://example.com/icon.png",
      });
      expect(updated?.iconUrl).toBe("https://example.com/icon.png");
      const refetched = await repo.findById("community-1");
      expect(refetched?.iconUrl).toBe("https://example.com/icon.png");
    });

    it("coverUrl を更新できる", async () => {
      const repo = createInMemoryCommunityRepository([makeCommunity()]);
      const updated = await repo.update("community-1", {
        coverUrl: "https://example.com/cover.png",
      });
      expect(updated?.coverUrl).toBe("https://example.com/cover.png");
    });

    it("iconUrl 更新時に name / description は変更されない", async () => {
      const repo = createInMemoryCommunityRepository([makeCommunity()]);
      const updated = await repo.update("community-1", {
        iconUrl: "https://example.com/icon.png",
      });
      expect(updated?.name).toBe("Technology");
      expect(updated?.description).toBe("テクノロジーコミュニティ");
    });

    it("存在しない id の更新は null を返す", async () => {
      const repo = createInMemoryCommunityRepository([]);
      const updated = await repo.update("nope", { iconUrl: "https://example.com/icon.png" });
      expect(updated).toBeNull();
    });
  });
});
