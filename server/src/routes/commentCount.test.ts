import { describe, expect, it, vi } from "vitest";

import { attachCommentCount } from "./commentCount.js";
import type { CommentRepository } from "../persistence/commentRepository.js";

function makeRepo(map: Map<string, number>): CommentRepository {
  return {
    countByPostIds: vi.fn().mockResolvedValue(map),
  } as unknown as CommentRepository;
}

describe("attachCommentCount", () => {
  it("空配列を渡すと [] を即返し、countByPostIds は呼ばれない", async () => {
    const repo = makeRepo(new Map());
    const result = await attachCommentCount([], repo);
    expect(result).toEqual([]);
    expect(repo.countByPostIds).not.toHaveBeenCalled();
  });

  it("Map に存在する post には正しい commentCount が付く", async () => {
    const repo = makeRepo(new Map([["post-1", 5], ["post-2", 3]]));
    const posts = [{ id: "post-1" }, { id: "post-2" }];
    const result = await attachCommentCount(posts, repo);
    expect(result).toEqual([
      { id: "post-1", commentCount: 5 },
      { id: "post-2", commentCount: 3 },
    ]);
  });

  it("Map に存在しない post は commentCount=0 になる（?? 0 フォールバック・#500）", async () => {
    const repo = makeRepo(new Map([["post-1", 2]]));
    const posts = [{ id: "post-1" }, { id: "post-no-comments" }];
    const result = await attachCommentCount(posts, repo);
    expect(result[0].commentCount).toBe(2);
    expect(result[1].commentCount).toBe(0);
  });

  it("複数 post に対して countByPostIds を 1 回だけ呼ぶ（N+1 回避）", async () => {
    const repo = makeRepo(new Map([["p1", 1], ["p2", 2], ["p3", 3]]));
    const posts = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    await attachCommentCount(posts, repo);
    expect(repo.countByPostIds).toHaveBeenCalledTimes(1);
    expect(repo.countByPostIds).toHaveBeenCalledWith(["p1", "p2", "p3"]);
  });

  it("元のレコードの他フィールドが保持される", async () => {
    const repo = makeRepo(new Map([["post-1", 7]]));
    const posts = [{ id: "post-1", title: "Hello", score: 10 }];
    const result = await attachCommentCount(posts, repo);
    expect(result[0]).toEqual({ id: "post-1", title: "Hello", score: 10, commentCount: 7 });
  });
});
