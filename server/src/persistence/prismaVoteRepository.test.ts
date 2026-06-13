import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaVoteRepository } from "./prismaVoteRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaVoteRepository (integration)", () => {
  let prisma: PrismaClient;
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  async function setupFixtures() {
    const u1 = await prisma.user.create({
      data: { loginId: "vote-user-1", displayName: "Vote User 1" },
    });
    const u2 = await prisma.user.create({
      data: { loginId: "vote-user-2", displayName: "Vote User 2" },
    });
    userId = u1.id;
    userId2 = u2.id;
  }

  describe("findVote", () => {
    it("未投票のとき null を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.findVote(userId, "post", "post-abc");

      expect(result).toBeNull();
    });

    it("投票済みのとき VoteRecord を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-abc", "up");
      const result = await repo.findVote(userId, "post", "post-abc");

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
      expect(result?.targetType).toBe("post");
      expect(result?.targetId).toBe("post-abc");
      expect(result?.direction).toBe("up");
    });

    it("targetType が異なる場合は null を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "target-1", "up");
      const result = await repo.findVote(userId, "comment", "target-1");

      expect(result).toBeNull();
    });
  });

  describe("vote — toggle/switch ロジック", () => {
    it("未投票 → up: scoreDelta = +1、レコード作成", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "up");

      expect(scoreDelta).toBe(1);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found?.direction).toBe("up");
    });

    it("未投票 → down: scoreDelta = -1、レコード作成", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "down");

      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found?.direction).toBe("down");
    });

    it("up 済み → up (toggle off): scoreDelta = -1、レコード削除", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "up");
      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "up");

      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found).toBeNull();
    });

    it("down 済み → down (toggle off): scoreDelta = +1、レコード削除", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "down");
      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "down");

      expect(scoreDelta).toBe(1);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found).toBeNull();
    });

    it("up 済み → down (switch): scoreDelta = -2", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "up");
      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "down");

      expect(scoreDelta).toBe(-2);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found?.direction).toBe("down");
    });

    it("down 済み → up (switch): scoreDelta = +2", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "down");
      const { scoreDelta } = await repo.vote(userId, "post", "post-1", "up");

      expect(scoreDelta).toBe(2);
      const found = await repo.findVote(userId, "post", "post-1");
      expect(found?.direction).toBe("up");
    });

    it("post と comment の vote は独立して管理される", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "target-1", "up");
      await repo.vote(userId, "comment", "target-1", "down");

      expect((await repo.findVote(userId, "post", "target-1"))?.direction).toBe("up");
      expect((await repo.findVote(userId, "comment", "target-1"))?.direction).toBe("down");
    });

    it("異なるユーザーの vote は独立して管理される", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "up");
      await repo.vote(userId2, "post", "post-1", "down");

      expect((await repo.findVote(userId, "post", "post-1"))?.direction).toBe("up");
      expect((await repo.findVote(userId2, "post", "post-1"))?.direction).toBe("down");
    });

    it("同一ユーザーが同一対象へ重複 vote しない（ユニーク制約）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote(userId, "post", "post-1", "up");
      await repo.vote(userId, "post", "post-1", "up");

      const votes = await prisma.vote.findMany({ where: { userId } });
      expect(votes).toHaveLength(0);
    });
  });
});
