import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaPostRepository } from "./prismaPostRepository.js";
import { createPrismaCommunityRepository } from "./prismaCommunityRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaPostRepository (integration)", () => {
  let prisma: PrismaClient;
  let communityId: string;
  let communityId2: string;

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

  async function setupCommunities() {
    const communityRepo = createPrismaCommunityRepository(prisma);
    const c1 = await communityRepo.create({ slug: "tech-post", name: "Tech", description: "Tech community" });
    const c2 = await communityRepo.create({ slug: "daily-post", name: "Daily", description: "Daily community" });
    communityId = c1.id;
    communityId2 = c2.id;
  }

  describe("createMany", () => {
    it("複数の post を作成し PostRecord[] を返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      const result = await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title 1", text: "Text 1" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "Title 2", text: "Text 2" },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].communityId).toBe(communityId);
      expect(result[0].title).toBe("Title 1");
      expect(result[0].score).toBe(0);
      expect(result[1].seq).toBe(1);
    });

    it("(communityId, slotKey, seq) が重複する場合は既存を返す（Cron 二重発火ガード）", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);
      const second = await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);

      expect(second).toHaveLength(1);
      const all = await repo.listByCommunity(communityId);
      expect(all).toHaveLength(1);
    });
  });

  describe("listByCommunity", () => {
    it("community の post を createdAt 降順で返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Old", text: "Old" },
      ]);
      await new Promise((r) => setTimeout(r, 100));
      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T18:00", seq: 0, author: "worker-2", title: "New", text: "New" },
      ]);

      const result = await repo.listByCommunity(communityId);

      expect(result[0].title).toBe("New");
      expect(result[1].title).toBe("Old");
    });

    it("別の community の post は含めない", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C1 Post", text: "text" },
      ]);
      await repo.createMany(communityId2, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C2 Post", text: "text" },
      ]);

      const result = await repo.listByCommunity(communityId);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("C1 Post");
    });

    it("limit が効く", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Post 1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "Post 2", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", title: "Post 3", text: "text" },
      ]);

      const result = await repo.listByCommunity(communityId, 2);

      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("存在する id で PostRecord を返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      const [created] = await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);

      const result = await repo.findById(created!.id);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Title");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaPostRepository(prisma);

      const result = await repo.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("addScore", () => {
    it("score を加算できる", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      const [created] = await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
      ]);

      const updated = await repo.addScore(created!.id, 1);

      expect(updated?.score).toBe(1);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaPostRepository(prisma);

      const result = await repo.addScore("non-existent-id", 1);

      expect(result).toBeNull();
    });
  });

  describe("listLatest", () => {
    it("全 community の post を createdAt 降順で返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);

      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C1 Post", text: "text" },
      ]);
      await new Promise((r) => setTimeout(r, 100));
      await repo.createMany(communityId2, [
        { slotKey: "2026-06-10T18:00", seq: 0, author: "worker-2", title: "C2 Post", text: "text" },
      ]);

      const result = await repo.listLatest();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("C2 Post");
    });

    it("post が 0 件のときは空配列を返す", async () => {
      const repo = createPrismaPostRepository(prisma);

      const result = await repo.listLatest();

      expect(result).toEqual([]);
    });

    it("limit が効く", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "P1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "P2", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", title: "P3", text: "text" },
      ]);

      const result = await repo.listLatest(2);

      expect(result).toHaveLength(2);
    });
  });

  describe("listLatestPaged", () => {
    it("cursor なし: 先頭ページを返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "P1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "P2", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", title: "P3", text: "text" },
      ]);

      const { posts, nextCursor } = await repo.listLatestPaged(undefined, 2);

      expect(posts).toHaveLength(2);
      expect(nextCursor).not.toBeNull();
    });

    it("cursor あり: 継続ページを返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "P1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "P2", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", title: "P3", text: "text" },
      ]);

      const first = await repo.listLatestPaged(undefined, 2);
      expect(first.nextCursor).not.toBeNull();
      const second = await repo.listLatestPaged(first.nextCursor!, 2);

      expect(second.posts).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
    });

    it("post が空のとき空配列と nextCursor=null を返す", async () => {
      const repo = createPrismaPostRepository(prisma);

      const { posts, nextCursor } = await repo.listLatestPaged(undefined, 20);

      expect(posts).toEqual([]);
      expect(nextCursor).toBeNull();
    });

    it("件数がちょうど limit のとき nextCursor は null を返す", async () => {
      await setupCommunities();
      const repo = createPrismaPostRepository(prisma);
      await repo.createMany(communityId, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "P1", text: "text" },
        { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "P2", text: "text" },
      ]);

      const { posts, nextCursor } = await repo.listLatestPaged(undefined, 2);

      expect(posts).toHaveLength(2);
      expect(nextCursor).toBeNull();
    });
  });
});
