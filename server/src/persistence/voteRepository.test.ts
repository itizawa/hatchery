import { describe, expect, it } from "vitest";
import { createInMemoryVoteRepository } from "./voteRepository.js";

describe("createInMemoryVoteRepository", () => {
  describe("findVote", () => {
    it("vote が無いとき null を返す", async () => {
      const repo = createInMemoryVoteRepository();
      const result = await repo.findVote("user-1", "post", "post-1");
      expect(result).toBeNull();
    });

    it("vote が有るとき VoteRecord を返す", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "up");
      const result = await repo.findVote("user-1", "post", "post-1");
      expect(result).not.toBeNull();
      expect(result?.direction).toBe("up");
    });

    it("targetType が異なる場合は null を返す", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "up");
      const result = await repo.findVote("user-1", "comment", "post-1");
      expect(result).toBeNull();
    });
  });

  describe("vote — toggle/switch ロジック", () => {
    it("未投票 → up: scoreDelta = +1", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "up");
      expect(scoreDelta).toBe(1);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found?.direction).toBe("up");
    });

    it("未投票 → down: scoreDelta = -1", async () => {
      const repo = createInMemoryVoteRepository();
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "down");
      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found?.direction).toBe("down");
    });

    it("up 済み → up (toggle off): scoreDelta = -1、レコード削除", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "up");
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "up");
      expect(scoreDelta).toBe(-1);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found).toBeNull();
    });

    it("down 済み → down (toggle off): scoreDelta = +1、レコード削除", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "down");
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "down");
      expect(scoreDelta).toBe(1);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found).toBeNull();
    });

    it("up 済み → down (switch): scoreDelta = -2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "up");
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "down");
      expect(scoreDelta).toBe(-2);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found?.direction).toBe("down");
    });

    it("down 済み → up (switch): scoreDelta = +2", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "post-1", "down");
      const { scoreDelta } = await repo.vote("user-1", "post", "post-1", "up");
      expect(scoreDelta).toBe(2);
      const found = await repo.findVote("user-1", "post", "post-1");
      expect(found?.direction).toBe("up");
    });

    it("post と comment の vote は独立して管理される", async () => {
      const repo = createInMemoryVoteRepository();
      await repo.vote("user-1", "post", "target-1", "up");
      await repo.vote("user-1", "comment", "target-1", "down");
      expect((await repo.findVote("user-1", "post", "target-1"))?.direction).toBe("up");
      expect((await repo.findVote("user-1", "comment", "target-1"))?.direction).toBe("down");
    });
  });
});
