import { describe, expect, it } from "vitest";
import { InMemoryVoteRepository } from "./voteRepository.js";

describe("InMemoryVoteRepository", () => {
  describe("hasVoted", () => {
    it("vote 済みの場合 true を返す", async () => {
      const repo = new InMemoryVoteRepository();
      await repo.create("user-1", "post", "post-1");
      const result = await repo.hasVoted("user-1", "post", "post-1");
      expect(result).toBe(true);
    });

    it("未 vote の場合 false を返す", async () => {
      const repo = new InMemoryVoteRepository();
      const result = await repo.hasVoted("user-1", "post", "post-1");
      expect(result).toBe(false);
    });

    it("targetType が異なる場合は false を返す", async () => {
      const repo = new InMemoryVoteRepository();
      await repo.create("user-1", "post", "post-1");
      // comment の targetId が同じでも post とは別
      const result = await repo.hasVoted("user-1", "comment", "post-1");
      expect(result).toBe(false);
    });
  });

  describe("create", () => {
    it("vote を作成できる", async () => {
      const repo = new InMemoryVoteRepository();
      await expect(repo.create("user-1", "post", "post-1")).resolves.toBeUndefined();
      const result = await repo.hasVoted("user-1", "post", "post-1");
      expect(result).toBe(true);
    });

    it("post と comment の vote は独立して管理される", async () => {
      const repo = new InMemoryVoteRepository();
      await repo.create("user-1", "post", "target-1");
      await repo.create("user-1", "comment", "target-1");
      expect(await repo.hasVoted("user-1", "post", "target-1")).toBe(true);
      expect(await repo.hasVoted("user-1", "comment", "target-1")).toBe(true);
    });
  });
});
