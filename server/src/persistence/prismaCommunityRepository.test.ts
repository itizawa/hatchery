import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaCommunityRepository } from "./prismaCommunityRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaCommunityRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.community.deleteMany();
  });

  describe("findById", () => {
    it("存在する id で CommunityRecord を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);
      const created = await repo.create({ slug: "tech", name: "Technology", description: "Tech community" });

      const result = await repo.findById(created.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
      expect(result?.slug).toBe("tech");
      expect(result?.name).toBe("Technology");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);

      const result = await repo.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("存在する slug で CommunityRecord を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);
      await repo.create({ slug: "daily", name: "Daily", description: "Daily community" });

      const result = await repo.findBySlug("daily");

      expect(result).not.toBeNull();
      expect(result?.slug).toBe("daily");
    });

    it("存在しない slug は null を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);

      const result = await repo.findBySlug("not-exists");

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("空の場合は空配列を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);

      const result = await repo.list();

      expect(result).toEqual([]);
    });

    it("複数件を createdAt 昇順で返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);
      await repo.create({ slug: "first", name: "First", description: "First community" });
      await new Promise((r) => setTimeout(r, 100));
      await repo.create({ slug: "second", name: "Second", description: "Second community" });

      const result = await repo.list();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("first");
      expect(result[1].slug).toBe("second");
    });
  });

  describe("create", () => {
    it("community を作成し id・createdAt が付与された CommunityRecord を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);

      const result = await repo.create({ slug: "new-community", name: "New Community", description: "Desc" });

      expect(result.id).toBeDefined();
      expect(result.slug).toBe("new-community");
      expect(result.name).toBe("New Community");
      expect(result.description).toBe("Desc");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.synopsis).toBeNull();
      expect(result.lastSlotKey).toBeNull();
    });
  });

  describe("update", () => {
    it("name を更新して返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);
      const created = await repo.create({ slug: "update-test", name: "Old Name", description: "Desc" });

      const result = await repo.update(created.id, { name: "New Name" });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("New Name");
      expect(result?.description).toBe("Desc");
    });

    it("description を更新して返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);
      const created = await repo.create({ slug: "update-desc", name: "Name", description: "Old Desc" });

      const result = await repo.update(created.id, { description: "New Desc" });

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Name");
      expect(result?.description).toBe("New Desc");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaCommunityRepository(prisma);

      const result = await repo.update("non-existent-id", { name: "Name" });

      expect(result).toBeNull();
    });
  });
});
