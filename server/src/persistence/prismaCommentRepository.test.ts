import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaCommentRepository } from "./prismaCommentRepository.js";
import { createPrismaCommunityRepository } from "./prismaCommunityRepository.js";
import { createPrismaPostRepository } from "./prismaPostRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaCommentRepository (integration)", () => {
  let prisma: PrismaClient;
  let communityId: string;
  let communityId2: string;
  let postId: string;
  let postId2: string;

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

  async function setupFixtures() {
    const communityRepo = createPrismaCommunityRepository(prisma);
    const postRepo = createPrismaPostRepository(prisma);

    const c1 = await communityRepo.create({ slug: "tech-comment", name: "Tech", description: "Tech community" });
    const c2 = await communityRepo.create({ slug: "daily-comment", name: "Daily", description: "Daily community" });
    communityId = c1.id;
    communityId2 = c2.id;

    const [p1] = await postRepo.createMany(communityId, [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Post 1", text: "Text 1" },
    ]);
    const [p2] = await postRepo.createMany(communityId, [
      { slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", title: "Post 2", text: "Text 2" },
    ]);
    postId = p1!.id;
    postId2 = p2!.id;
  }

  describe("createMany", () => {
    it("複数の comment を作成し CommentRecord[] を返す", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      const result = await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment 1" },
        { postId, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "Comment 2" },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].communityId).toBe(communityId);
      expect(result[0].postId).toBe(postId);
      expect(result[0].score).toBe(0);
    });

    it("(communityId, slotKey, seq) が重複する場合は既存を返す（Cron 二重発火ガード）", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);
      const second = await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);

      expect(second).toHaveLength(1);
      const all = await repo.listByPost(postId);
      expect(all).toHaveLength(1);
    });
  });

  describe("listByPost", () => {
    it("post のコメントを createdAt 昇順で返す", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "First" },
      ]);
      await new Promise((r) => setTimeout(r, 100));
      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "Second" },
      ]);

      const result = await repo.listByPost(postId);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("First");
      expect(result[1].text).toBe("Second");
    });

    it("別の post のコメントは含めない", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "P1 Comment" },
        { postId: postId2, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "P2 Comment" },
      ]);

      const result = await repo.listByPost(postId);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("P1 Comment");
    });
  });

  describe("listByCommunity", () => {
    it("community のコメントを createdAt 昇順で返す", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment 1" },
        { postId, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "Comment 2" },
      ]);

      const result = await repo.listByCommunity(communityId);

      expect(result).toHaveLength(2);
    });

    it("別の community のコメントは含めない", async () => {
      await setupFixtures();
      const postRepo = createPrismaPostRepository(prisma);
      const [p3] = await postRepo.createMany(communityId2, [
        { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "C2 Post", text: "text" },
      ]);
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "C1 Comment" },
      ]);
      await repo.createMany(communityId2, [
        { postId: p3!.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "C2 Comment" },
      ]);

      const result = await repo.listByCommunity(communityId);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("C1 Comment");
    });

    it("limit が効く", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);

      await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "C1" },
        { postId, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-2", text: "C2" },
        { postId, slotKey: "2026-06-10T09:00", seq: 2, author: "worker-3", text: "C3" },
      ]);

      const result = await repo.listByCommunity(communityId, 2);

      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("存在する id で CommentRecord を返す", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);
      const [created] = await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);

      const result = await repo.findById(created!.id);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("Comment");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaCommentRepository(prisma);

      const result = await repo.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("addScore", () => {
    it("score を加算できる", async () => {
      await setupFixtures();
      const repo = createPrismaCommentRepository(prisma);
      const [created] = await repo.createMany(communityId, [
        { postId, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", text: "Comment" },
      ]);

      const updated = await repo.addScore(created!.id, 1);

      expect(updated?.score).toBe(1);
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaCommentRepository(prisma);

      const result = await repo.addScore("non-existent-id", 1);

      expect(result).toBeNull();
    });
  });
});
