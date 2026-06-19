import { describe, expect, it } from "vitest";

import { calcCommentCount, pickOldPostForRevival } from "./calcCommentCounts.js";
import type { PostRecord } from "../persistence/postRepository.js";

function makePost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    id: "post-id",
    communityId: "community-id",
    slotKey: "2026-01-01T09:00",
    seq: 0,
    author: "worker-id",
    title: "title",
    text: "text",
    score: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("calcCommentCount", () => {
  it("score=0 → base件(1件)", () => {
    expect(calcCommentCount(0)).toBe(1);
  });

  it("score=2 → clamp(1 + round(0.5×2), 1, 5) = 2", () => {
    expect(calcCommentCount(2)).toBe(2);
  });

  it("score=4 → clamp(1 + round(0.5×4), 1, 5) = 3", () => {
    expect(calcCommentCount(4)).toBe(3);
  });

  it("score=8 → clamp(1 + round(0.5×8), 1, 5) = 5 (max)", () => {
    expect(calcCommentCount(8)).toBe(5);
  });

  it("score=100 → max=5 に clamp される", () => {
    expect(calcCommentCount(100)).toBe(5);
  });

  it("score=-1 → max(0, -1)=0 → base(1)件（負スコアは0扱い）", () => {
    expect(calcCommentCount(-1)).toBe(1);
  });

  it("score=-10 → base(1)件", () => {
    expect(calcCommentCount(-10)).toBe(1);
  });

  it("カスタム定数: base=2, k=1, min=2, max=10", () => {
    expect(calcCommentCount(4, { base: 2, k: 1, min: 2, max: 10 })).toBe(6);
  });
});

describe("pickOldPostForRevival", () => {
  it("oldPosts が空の場合は null を返す", () => {
    const result = pickOldPostForRevival([], 0.1, () => 0.05);
    expect(result).toBeNull();
  });

  it("rng() >= p の場合は null を返す（確率外れ）", () => {
    const post = makePost({ id: "old-post" });
    const result = pickOldPostForRevival([post], 0.1, () => 0.9);
    expect(result).toBeNull();
  });

  it("rng() < p の場合は oldPosts からランダムに1件返す", () => {
    const post = makePost({ id: "old-post" });
    // rng が最初の呼び出し(確率判定)で 0.05 を返し、次(インデックス選択)で 0.0 を返す
    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.05 : 0.0;
    };
    const result = pickOldPostForRevival([post], 0.1, rng);
    expect(result).toEqual(post);
  });

  it("複数の古い post から選択する", () => {
    const posts = [
      makePost({ id: "old-1" }),
      makePost({ id: "old-2" }),
      makePost({ id: "old-3" }),
    ];
    let callCount = 0;
    const rng = () => {
      callCount++;
      // 1回目: 確率判定（0.05 < 0.1 → 通過）、2回目: インデックス（2/3 ≈ 0.667 → idx=2）
      return callCount === 1 ? 0.05 : 0.667;
    };
    const result = pickOldPostForRevival(posts, 0.1, rng);
    expect(result?.id).toBe("old-3");
  });

  it("p=0 の場合は必ず null を返す", () => {
    const post = makePost({ id: "old-post" });
    // rng() は 0 を返しても p=0 なので常に null
    const result = pickOldPostForRevival([post], 0, () => 0);
    expect(result).toBeNull();
  });

  it("p=1 の場合は必ず1件返す", () => {
    const post = makePost({ id: "old-post" });
    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.999 : 0.0;
    };
    const result = pickOldPostForRevival([post], 1, rng);
    expect(result).toEqual(post);
  });
});
