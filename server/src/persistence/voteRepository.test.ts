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

  describe("voteAndApplyScore — vote と score 更新を 1 操作で整合させる (#453)", () => {
    // 対象スコアストアを模した applyScore コールバック（route が postRepo/commentRepo.addScore を渡す想定）。
    function createRepoWithScores() {
      const scores = new Map<string, number>([
        ["post:post-1", 0],
        ["comment:comment-1", 0],
      ]);
      const makeApply =
        (targetKey: string) =>
        (delta: number): Promise<number | null> => {
          if (!scores.has(targetKey)) return Promise.resolve(null);
          const next = (scores.get(targetKey) ?? 0) + delta;
          scores.set(targetKey, next);
          return Promise.resolve(next);
        };
      const repo = createInMemoryVoteRepository();
      return { repo, scores, makeApply };
    }

    it("未投票 → up: scoreDelta=+1 と更新後 score=1 を返し、vote レコードが作られる", async () => {
      const { repo, makeApply } = createRepoWithScores();
      const result = await repo.voteAndApplyScore("u1", "post", "post-1", "up", makeApply("post:post-1"));
      expect(result).toEqual({ scoreDelta: 1, score: 1 });
      expect((await repo.findVote("u1", "post", "post-1"))?.direction).toBe("up");
    });

    it("未投票 → down: scoreDelta=-1 と更新後 score=-1 を返す", async () => {
      const { repo, makeApply } = createRepoWithScores();
      const result = await repo.voteAndApplyScore("u1", "post", "post-1", "down", makeApply("post:post-1"));
      expect(result).toEqual({ scoreDelta: -1, score: -1 });
    });

    it("up 済み → up (toggle off): scoreDelta=-1 と更新後 score=0、レコード削除", async () => {
      const { repo, makeApply } = createRepoWithScores();
      await repo.voteAndApplyScore("u1", "post", "post-1", "up", makeApply("post:post-1"));
      const result = await repo.voteAndApplyScore("u1", "post", "post-1", "up", makeApply("post:post-1"));
      expect(result).toEqual({ scoreDelta: -1, score: 0 });
      expect(await repo.findVote("u1", "post", "post-1")).toBeNull();
    });

    it("up 済み → down (switch): scoreDelta=-2 と更新後 score=-1", async () => {
      const { repo, makeApply } = createRepoWithScores();
      await repo.voteAndApplyScore("u1", "post", "post-1", "up", makeApply("post:post-1"));
      const result = await repo.voteAndApplyScore("u1", "post", "post-1", "down", makeApply("post:post-1"));
      expect(result).toEqual({ scoreDelta: -2, score: -1 });
      expect((await repo.findVote("u1", "post", "post-1"))?.direction).toBe("down");
    });

    it("comment にも適用できる（post と独立）", async () => {
      const { repo, makeApply } = createRepoWithScores();
      const result = await repo.voteAndApplyScore(
        "u1",
        "comment",
        "comment-1",
        "up",
        makeApply("comment:comment-1"),
      );
      expect(result).toEqual({ scoreDelta: 1, score: 1 });
    });

    it("対象が存在しない場合 score=null を返す（applyScore が null）", async () => {
      const { repo, makeApply } = createRepoWithScores();
      const result = await repo.voteAndApplyScore("u1", "post", "missing", "up", makeApply("post:missing"));
      expect(result.scoreDelta).toBe(1);
      expect(result.score).toBeNull();
    });
  });

  describe("netScoresByCommunitySince (#486)", () => {
    // targetId → communityId の解決マップ（テスト用）。
    const resolve = (targetType: "post" | "comment", targetId: string): string | null => {
      const map: Record<string, string> = {
        "post:p1": "community-1",
        "post:p2": "community-1",
        "post:p3": "community-2",
        "comment:c1": "community-1",
        "comment:c2": "community-2",
      };
      return map[`${targetType}:${targetId}`] ?? null;
    };

    it("community 別に純スコア（up:+1 / down:-1）を集計して返す", async () => {
      const repo = createInMemoryVoteRepository(resolve);
      // community-1: p1 up(+1), p2 up(+1), c1 down(-1) = +1
      await repo.vote("u1", "post", "p1", "up");
      await repo.vote("u2", "post", "p2", "up");
      await repo.vote("u3", "comment", "c1", "down");
      // community-2: p3 down(-1), c2 down(-1) = -2
      await repo.vote("u1", "post", "p3", "down");
      await repo.vote("u2", "comment", "c2", "down");

      const result = await repo.netScoresByCommunitySince(new Date("2020-01-01"));

      expect(result.get("community-1")).toBe(1);
      expect(result.get("community-2")).toBe(-2);
    });

    it("since より前の vote は集計から除外する", async () => {
      const now = new Date("2026-06-13T00:00:00Z");
      const repo = createInMemoryVoteRepository(resolve, () => now);
      // 直近 vote（since 以降）
      await repo.vote("u1", "post", "p1", "up");

      // since を「今より未来」に置くと、上記 vote は除外され空になる。
      const future = new Date("2026-06-20T00:00:00Z");
      const result = await repo.netScoresByCommunitySince(future);

      expect(result.get("community-1")).toBeUndefined();
    });

    it("community に解決できない vote は無視する", async () => {
      const repo = createInMemoryVoteRepository(resolve);
      await repo.vote("u1", "post", "unknown", "up"); // 解決不能

      const result = await repo.netScoresByCommunitySince(new Date("2020-01-01"));

      expect(result.size).toBe(0);
    });

    it("vote が 0 件のとき空の Map を返す", async () => {
      const repo = createInMemoryVoteRepository(resolve);
      const result = await repo.netScoresByCommunitySince(new Date("2020-01-01"));
      expect(result.size).toBe(0);
    });
  });
});
