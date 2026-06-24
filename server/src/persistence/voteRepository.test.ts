import { describe, expect, it } from "vitest";
import { createInMemoryVoteRepository } from "./voteRepository.js";

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
});
