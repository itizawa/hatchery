import { describe, expect, it } from "vitest";
import { createInMemoryVoteRepository } from "./voteRepository.js";
import type { ResolveTrendingTargetMeta, TrendingTargetMeta } from "./voteRepository.js";

describe("createInMemoryVoteRepository", () => {
  describe("findVote", () => {
    it("未投票のとき null を返す", async () => {
      const repo = createInMemoryVoteRepository();
      const result = await repo.findVote({ sessionId: "s1", targetType: "post", targetId: "p1" });
      expect(result).toBeNull();
    });

    it("投票済みのとき VoteRecord を返す", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const result = await repo.findVote({ sessionId: "s1", targetType: "post", targetId: "p1" });
      expect(result).not.toBeNull();
      expect(result?.direction).toBe("up");
    });
  });

  describe("vote（toggle / switch ロジック）", () => {
    it("未投票 → up: scoreDelta=+1", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      expect(scoreDelta).toBe(1);
    });

    it("up → toggle off: scoreDelta=-1", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { scoreDelta } = await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      expect(scoreDelta).toBe(-1);
    });

    it("未投票 → down: scoreDelta=-1", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      expect(scoreDelta).toBe(-1);
    });

    it("up → down switch: scoreDelta=-2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { scoreDelta } = await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      expect(scoreDelta).toBe(-2);
    });

    it("down → up switch: scoreDelta=+2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      const { scoreDelta } = await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      expect(scoreDelta).toBe(2);
    });
  });

  describe("findVotesBySessionAndTargets（#831）", () => {
    it("投票済みの targetId が Map に含まれる", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p2", direction: "down" });

      const result = await repo.findVotesBySessionAndTargets({
        sessionId: "s1",
        targetType: "post",
        targetIds: ["p1", "p2", "p3"],
      });

      expect(result.get("p1")).toBe("up");
      expect(result.get("p2")).toBe("down");
      expect(result.has("p3")).toBe(false);
    });

    it("別セッションの vote は含まれない（セッション分離）", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      await repo.vote({ sessionId: "s2", userId: null, targetType: "post", targetId: "p1", direction: "down" });

      const result = await repo.findVotesBySessionAndTargets({
        sessionId: "s1",
        targetType: "post",
        targetIds: ["p1"],
      });

      expect(result.get("p1")).toBe("up");
    });

    it("targetType が異なる vote は含まれない", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "comment", targetId: "c1", direction: "up" });

      const result = await repo.findVotesBySessionAndTargets({
        sessionId: "s1",
        targetType: "post",
        targetIds: ["c1"],
      });

      expect(result.has("c1")).toBe(false);
    });

    it("targetIds が空配列のとき空 Map を返す", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const result = await repo.findVotesBySessionAndTargets({
        sessionId: "s1",
        targetType: "post",
        targetIds: [],
      });

      expect(result.size).toBe(0);
    });

    it("toggle off 後は Map から除外される", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      // toggle off
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const result = await repo.findVotesBySessionAndTargets({
        sessionId: "s1",
        targetType: "post",
        targetIds: ["p1"],
      });

      expect(result.has("p1")).toBe(false);
    });
  });

  describe("voteAndApplyScore（toggle / switch / score 更新）", () => {
    it("未投票 → up: scoreDelta=+1, score が applyScore で更新される", async () => {
      const repo = createInMemoryVoteRepository();
      let appliedDelta: number | undefined;
      const { scoreDelta, score } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "up",
        applyScore: async (delta) => { appliedDelta = delta; return 10 + delta; },
      });
      expect(scoreDelta).toBe(1);
      expect(appliedDelta).toBe(1);
      expect(score).toBe(11);
    });

    it("up → toggle off: scoreDelta=-1", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(-1);
    });

    it("未投票 → down: scoreDelta=-1", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(-1);
    });

    it("down → toggle off: scoreDelta=+1", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(1);
    });

    it("up → down switch: scoreDelta=-2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(-2);
    });

    it("down → up switch: scoreDelta=+2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "post",
        targetId: "p1",
        direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(2);
    });

    it("comment 対象でも scoreDelta が正しく返る", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.voteAndApplyScore({
        sessionId: "s1",
        userId: null,
        targetType: "comment",
        targetId: "c1",
        direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(scoreDelta).toBe(1);
    });
  });

  describe("voteAndApplyScore — currentDirection (#853)", () => {
    it("未投票 → up: currentDirection=up", async () => {
      const repo = createInMemoryVoteRepository();
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBe("up");
    });

    it("未投票 → down: currentDirection=down", async () => {
      const repo = createInMemoryVoteRepository();
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBe("down");
    });

    it("up 済み → up (toggle off): currentDirection=null", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBeNull();
    });

    it("down 済み → down (toggle off): currentDirection=null", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBeNull();
    });

    it("up 済み → down (switch): currentDirection=down", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBe("down");
    });

    it("down 済み → up (switch): currentDirection=up", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      const { currentDirection } = await repo.voteAndApplyScore({
        sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up",
        applyScore: async (delta) => delta,
      });
      expect(currentDirection).toBe("up");
    });
  });

  describe("trendingItemsSince（#1065）", () => {
    const SINCE = new Date("2026-06-01T00:00:00.000Z");

    const posts = new Map<string, TrendingTargetMeta>([
      [
        "p1",
        {
          postId: "p1",
          communityId: "c1",
          communitySlug: "technology",
          text: "post p1 の本文冒頭です",
          createdAt: new Date("2026-06-10T09:00:00.000Z"),
        },
      ],
      [
        "p2",
        {
          postId: "p2",
          communityId: "c1",
          communitySlug: "technology",
          text: "post p2 の本文冒頭です",
          createdAt: new Date("2026-06-11T09:00:00.000Z"),
        },
      ],
    ]);

    const comments = new Map<string, TrendingTargetMeta>([
      [
        "cm1",
        {
          postId: "p1",
          communityId: "c1",
          communitySlug: "technology",
          text: "comment cm1 の本文冒頭です",
          createdAt: new Date("2026-06-10T10:00:00.000Z"),
        },
      ],
    ]);

    // eslint-disable-next-line max-params
    const resolveTrendingTargetMeta: ResolveTrendingTargetMeta = async (targetType, targetId) => {
      const store = targetType === "post" ? posts : comments;
      return store.get(targetId) ?? null;
    };

    it("vote が 0 件のとき空配列を返す", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });
      expect(result).toEqual([]);
    });

    it("post への up vote を net_score に集計し type: post のアイテムを返す", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      await repo.vote({ sessionId: "s2", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result).toEqual([
        {
          type: "post",
          id: "p1",
          post_id: "p1",
          excerpt: "post p1 の本文冒頭です",
          community_id: "c1",
          community_slug: "technology",
          net_score: 2,
          created_at: "2026-06-10T09:00:00.000Z",
        },
      ]);
    });

    it("comment への vote は post_id に親 post の id を設定し type: comment を返す", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "comment", targetId: "cm1", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "comment", id: "cm1", post_id: "p1", net_score: 1 });
    });

    it("down vote が優勢だと net_score が負数になる", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      await repo.vote({ sessionId: "s2", userId: null, targetType: "post", targetId: "p1", direction: "down" });
      await repo.vote({ sessionId: "s3", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result[0]?.net_score).toBe(-1);
    });

    it("net_score 降順でソートされる", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p2", direction: "up" });
      await repo.vote({ sessionId: "s2", userId: null, targetType: "post", targetId: "p2", direction: "up" });
      await repo.vote({ sessionId: "s3", userId: null, targetType: "post", targetId: "p2", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result.map((item) => item.id)).toEqual(["p2", "p1"]);
    });

    it("limit で件数を制限する", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p2", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 1 });

      expect(result).toHaveLength(1);
    });

    it("since より前の vote は集計から除外する", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await repo.trendingItemsSince({ since: future, limit: 10 });

      expect(result).toEqual([]);
    });

    it("resolveTrendingTargetMeta が null を返す（対象が削除済み等）場合はスキップする", async () => {
      const repo = createInMemoryVoteRepository({ resolveTrendingTargetMeta });
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "unknown-post", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result).toEqual([]);
    });

    it("resolveTrendingTargetMeta 未注入のときは常に空配列を返す", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });

      const result = await repo.trendingItemsSince({ since: SINCE, limit: 10 });

      expect(result).toEqual([]);
    });
  });
});
