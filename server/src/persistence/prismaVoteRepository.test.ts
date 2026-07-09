import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaVoteRepository } from "./prismaVoteRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaVoteRepository (integration)", () => {
  let prisma: PrismaClient;
  let userId: string;
  let userId2: string;
  // 実在する Post / Comment（#453: Exclusive Arc 化で本物 FK になったため必須）。
  let communityId: string;
  let postId: string;
  let postId2: string;
  let commentId: string;

  // テスト用 sessionId（#777: sessionId を dedup キーに変更）。
  const sessId1 = "00000000-0000-7000-0000-000000000001";
  const sessId2 = "00000000-0000-7000-0000-000000000002";

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.vote.deleteMany();
    await prisma.community.deleteMany();
    await prisma.user.deleteMany();
  });

  /** user 2 名 + community 1 つ + post 2 つ + comment 1 つの実在フィクスチャを作る。 */
  async function setupFixtures() {
    const u1 = await prisma.user.create({
      data: { email: "vote-user-1@example.com", googleId: "vote-google-1", displayName: "Vote User 1" },
    });
    const u2 = await prisma.user.create({
      data: { email: "vote-user-2@example.com", googleId: "vote-google-2", displayName: "Vote User 2" },
    });
    userId = u1.id;
    userId2 = u2.id;

    const c1 = await prisma.community.create({
      data: { slug: "vote-int", name: "Vote Int", description: "vote integration" },
    });
    communityId = c1.id;
    const p1 = await prisma.post.create({
      data: { communityId, slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "t1", text: "x1" },
    });
    const p2 = await prisma.post.create({
      data: { communityId, slotKey: "2026-06-10T09:00", seq: 1, author: "w1", title: "t2", text: "x2" },
    });
    const cm1 = await prisma.comment.create({
      data: { communityId, postId: p1.id, slotKey: "2026-06-10T09:00", seq: 0, author: "w2", text: "cx1" },
    });
    postId = p1.id;
    postId2 = p2.id;
    commentId = cm1.id;
  }

  describe("findVote", () => {
    it("未投票のとき null を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });

      expect(result).toBeNull();
    });

    it("投票済みのとき VoteRecord を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      const result = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe(sessId1);
      expect(result?.userId).toBe(userId);
      expect(result?.targetType).toBe("post");
      expect(result?.targetId).toBe(postId);
      expect(result?.direction).toBe("up");
    });

    it("targetType が異なる場合は null を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      // 同じ id 文字列でも comment としては存在しない → null（混同しない）。
      const result = await repo.findVote({ sessionId: sessId1, targetType: "comment", targetId: postId });

      expect(result).toBeNull();
    });
  });

  describe("vote — toggle/switch ロジック", () => {
    it("未投票 → up: scoreDelta = +1、レコード作成", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });

      expect(scoreDelta).toBe(1);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found?.direction).toBe("up");
    });

    it("未投票 → down: scoreDelta = -1、レコード作成", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down" });

      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found?.direction).toBe("down");
    });

    it("up 済み → up (toggle off): scoreDelta = -1、レコード削除", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });

      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found).toBeNull();
    });

    it("down 済み → down (toggle off): scoreDelta = +1、レコード削除", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down" });
      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down" });

      expect(scoreDelta).toBe(1);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found).toBeNull();
    });

    it("up 済み → down (switch): scoreDelta = -2", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down" });

      expect(scoreDelta).toBe(-2);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found?.direction).toBe("down");
    });

    it("down 済み → up (switch): scoreDelta = +2", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down" });
      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });

      expect(scoreDelta).toBe(2);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found?.direction).toBe("up");
    });

    it("post と comment の vote は独立して管理される", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "comment", targetId: commentId, direction: "down" });

      expect((await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId }))?.direction).toBe("up");
      expect((await repo.findVote({ sessionId: sessId1, targetType: "comment", targetId: commentId }))?.direction).toBe("down");
    });

    it("異なる sessionId の vote は独立して管理される（#777: sessionId が dedup キー）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId2, userId: userId2, targetType: "post", targetId: postId, direction: "down" });

      expect((await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId }))?.direction).toBe("up");
      expect((await repo.findVote({ sessionId: sessId2, targetType: "post", targetId: postId }))?.direction).toBe("down");
    });

    it("同一 sessionId が同一対象へ重複 vote しない（ユニーク制約・AC4）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });

      const votes = await prisma.vote.findMany({ where: { sessionId: sessId1 } });
      expect(votes).toHaveLength(0);
    });

    it("同一 sessionId が異なる post には独立して vote できる（NULL 区別の複合ユニーク・AC4）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId2, direction: "up" });

      expect((await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId }))?.direction).toBe("up");
      expect((await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId2 }))?.direction).toBe("up");
      expect(await prisma.vote.count({ where: { sessionId: sessId1 } })).toBe(2);
    });

    it("ゲスト（userId=null）でも vote できる（#777）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const { scoreDelta } = await repo.vote({ sessionId: sessId1, userId: null, targetType: "post", targetId: postId, direction: "up" });

      expect(scoreDelta).toBe(1);
      const found = await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId });
      expect(found?.direction).toBe("up");
      expect(found?.userId).toBeNull();
    });
  });

  describe("Exclusive Arc 制約 (#453)", () => {
    it("存在しない Post への vote は FK 違反で拒否される（AC5）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await expect(repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: "non-existent-post-id", direction: "up" })).rejects.toThrow();
    });

    it("存在しない Comment への vote は FK 違反で拒否される（AC5）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await expect(repo.vote({ sessionId: sessId1, userId, targetType: "comment", targetId: "non-existent-comment-id", direction: "up" })).rejects.toThrow();
    });

    it("Post を削除すると関連 vote が cascade 削除される（AC6）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      expect(await prisma.vote.count({ where: { postId } })).toBe(1);

      await prisma.post.delete({ where: { id: postId } });

      expect(await prisma.vote.count({ where: { postId } })).toBe(0);
    });

    it("Comment を削除すると関連 vote が cascade 削除される（AC6）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "comment", targetId: commentId, direction: "up" });
      expect(await prisma.vote.count({ where: { commentId } })).toBe(1);

      await prisma.comment.delete({ where: { id: commentId } });

      expect(await prisma.vote.count({ where: { commentId } })).toBe(0);
    });
  });

  describe("voteAndApplyScore — vote と score 更新の単一トランザクション (#453・AC7)", () => {
    // Prisma 実装は score 更新を $transaction 内で内部的に行うため、
    // 渡された applyScore コールバックは呼ばれない（呼ばれたら失敗させて検出する）。
    const failIfCalled = (): Promise<number | null> => {
      throw new Error("applyScore should not be called by the Prisma implementation");
    };

    it("post: 未投票 → up で vote 作成と post.score +1 が同時に整合する", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up", applyScore: failIfCalled });

      expect(result.scoreDelta).toBe(1);
      expect(result.score).toBe(1);
      expect((await prisma.post.findUnique({ where: { id: postId } }))?.score).toBe(1);
      expect((await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId }))?.direction).toBe("up");
    });

    it("post: up 済み → down (switch) で score が -2 され更新後 score を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up", applyScore: failIfCalled }); // score=1
      const result = await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "down", applyScore: failIfCalled });

      expect(result.scoreDelta).toBe(-2);
      expect(result.score).toBe(-1);
      expect((await prisma.post.findUnique({ where: { id: postId } }))?.score).toBe(-1);
    });

    it("post: up 済み → up (toggle off) で vote 削除と score 0 が整合する", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up", applyScore: failIfCalled }); // score=1
      const result = await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up", applyScore: failIfCalled });

      expect(result.scoreDelta).toBe(-1);
      expect(result.score).toBe(0);
      expect(await repo.findVote({ sessionId: sessId1, targetType: "post", targetId: postId })).toBeNull();
    });

    it("comment: 未投票 → down で vote 作成と comment.score -1 が同時に整合する", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "comment", targetId: commentId, direction: "down", applyScore: failIfCalled });

      expect(result.scoreDelta).toBe(-1);
      expect(result.score).toBe(-1);
      expect((await prisma.comment.findUnique({ where: { id: commentId } }))?.score).toBe(-1);
    });

    it("存在しない対象への voteAndApplyScore は FK 違反で失敗し、score も vote も生成されない（原子性）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await expect(
        repo.voteAndApplyScore({ sessionId: sessId1, userId, targetType: "post", targetId: "non-existent-post-id", direction: "up", applyScore: failIfCalled }),
      ).rejects.toThrow();
      // 中間状態が残らない（vote が 0 件）。
      expect(await prisma.vote.count({ where: { sessionId: sessId1 } })).toBe(0);
    });
  });

  describe("netScoresByCommunitySince (#486)", () => {
    async function setupCommunityFixtures(): Promise<{
      community1: string;
      community2: string;
      post1: string; // community1
      post2: string; // community2
      comment1: string; // community1
    }> {
      const c1 = await prisma.community.create({
        data: { slug: "vote-agg-1", name: "C1", description: "c1" },
      });
      const c2 = await prisma.community.create({
        data: { slug: "vote-agg-2", name: "C2", description: "c2" },
      });
      const p1 = await prisma.post.create({
        data: {
          communityId: c1.id,
          slotKey: "2026-06-10T09:00",
          seq: 0,
          author: "w1",
          title: "t1",
          text: "x1",
        },
      });
      const p2 = await prisma.post.create({
        data: {
          communityId: c2.id,
          slotKey: "2026-06-10T09:00",
          seq: 0,
          author: "w1",
          title: "t2",
          text: "x2",
        },
      });
      const cm1 = await prisma.comment.create({
        data: {
          communityId: c1.id,
          postId: p1.id,
          slotKey: "2026-06-10T09:00",
          seq: 0,
          author: "w2",
          text: "cx1",
        },
      });
      return { community1: c1.id, community2: c2.id, post1: p1.id, post2: p2.id, comment1: cm1.id };
    }

    it("community 別に post / comment の純スコア（up:+1 / down:-1）を集計する", async () => {
      await setupFixtures();
      const fx = await setupCommunityFixtures();
      const repo = createPrismaVoteRepository(prisma);

      // community1: post1 up(+1)、comment1 down(-1) = 0
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: fx.post1, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "comment", targetId: fx.comment1, direction: "down" });
      // community2: post2 down(-1)、別 sessionId も post2 down(-1) = -2
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: fx.post2, direction: "down" });
      await repo.vote({ sessionId: sessId2, userId: userId2, targetType: "post", targetId: fx.post2, direction: "down" });

      const result = await repo.netScoresByCommunitySince(new Date("2020-01-01"));

      expect(result.get(fx.community1)).toBe(0);
      expect(result.get(fx.community2)).toBe(-2);
    });

    it("since より前の vote は集計から除外する", async () => {
      await setupFixtures();
      const fx = await setupCommunityFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: fx.post1, direction: "up" });

      // since を未来に置くと直近 vote が除外され空になる。
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await repo.netScoresByCommunitySince(future);

      expect(result.get(fx.community1)).toBeUndefined();
    });

    it("vote が 0 件のとき空の Map を返す", async () => {
      await setupFixtures();
      await setupCommunityFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.netScoresByCommunitySince(new Date("2020-01-01"));

      expect(result.size).toBe(0);
    });
  });

  describe("trendingItemsSince (#1065)", () => {
    it("vote が 0 件のとき空配列を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 10 });

      expect(result).toEqual([]);
    });

    it("post への vote を net_score に集計し type: post のアイテムを返す（community_slug 付き）", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId2, userId: userId2, targetType: "post", targetId: postId, direction: "up" });

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "post",
        id: postId,
        post_id: postId,
        community_id: communityId,
        community_slug: "vote-int",
        net_score: 2,
        excerpt: "x1",
      });
    });

    it("comment への vote は post_id に親 post の id を設定し type: comment を返す", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "comment", targetId: commentId, direction: "down" });

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "comment",
        id: commentId,
        post_id: postId,
        community_slug: "vote-int",
        net_score: -1,
      });
    });

    it("excerpt を本文冒頭60文字（コードポイント単位）+ '…' に切り詰める", async () => {
      await setupFixtures();
      const longText = "あ".repeat(70);
      const longPost = await prisma.post.create({
        data: { communityId, slotKey: "2026-06-10T09:01", seq: 5, author: "w1", title: "long", text: longText },
      });
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: longPost.id, direction: "up" });

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 10 });

      expect(result[0]?.excerpt).toBe("あ".repeat(60) + "…");
    });

    it("net_score 降順でソートされる", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId2, direction: "up" });
      await repo.vote({ sessionId: sessId2, userId: userId2, targetType: "post", targetId: postId2, direction: "up" });

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 10 });

      expect(result.map((item) => item.id)).toEqual([postId2, postId]);
    });

    it("limit で件数を制限する", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });
      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId2, direction: "up" });

      const result = await repo.trendingItemsSince({ since: new Date("2020-01-01"), limit: 1 });

      expect(result).toHaveLength(1);
    });

    it("since より前の vote は集計から除外する", async () => {
      await setupFixtures();
      const repo = createPrismaVoteRepository(prisma);

      await repo.vote({ sessionId: sessId1, userId, targetType: "post", targetId: postId, direction: "up" });

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await repo.trendingItemsSince({ since: future, limit: 10 });

      expect(result).toEqual([]);
    });
  });
});
