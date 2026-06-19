import { describe, expect, it } from "vitest";

import {
  CommentViewsRequestSchema,
  COMMENT_IDS_MAX_COUNT,
  PostViewRequestSchema,
  SESSION_ID_MAX_LENGTH,
  WorkerRankingItemSchema,
} from "./view.js";

describe("PostViewRequestSchema", () => {
  it("有効なリクエスト（sessionId あり）をパースできる", () => {
    const result = PostViewRequestSchema.safeParse({ sessionId: "sess-abc-123" });
    expect(result.success).toBe(true);
  });

  it("sessionId が空文字だと reject する", () => {
    expect(PostViewRequestSchema.safeParse({ sessionId: "" }).success).toBe(false);
  });

  it(`sessionId が ${SESSION_ID_MAX_LENGTH} 文字を超えると reject する`, () => {
    const long = "a".repeat(SESSION_ID_MAX_LENGTH + 1);
    expect(PostViewRequestSchema.safeParse({ sessionId: long }).success).toBe(false);
  });

  it(`sessionId が ${SESSION_ID_MAX_LENGTH} 文字ちょうどなら accept する`, () => {
    const exact = "a".repeat(SESSION_ID_MAX_LENGTH);
    expect(PostViewRequestSchema.safeParse({ sessionId: exact }).success).toBe(true);
  });

  it("sessionId が欠落すると reject する", () => {
    expect(PostViewRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("CommentViewsRequestSchema", () => {
  it("有効なリクエストをパースできる", () => {
    const result = CommentViewsRequestSchema.safeParse({
      sessionId: "sess-abc",
      commentIds: ["comment-1", "comment-2"],
    });
    expect(result.success).toBe(true);
  });

  it("commentIds が空配列でも accept する（no-op）", () => {
    const result = CommentViewsRequestSchema.safeParse({ sessionId: "sess-abc", commentIds: [] });
    expect(result.success).toBe(true);
  });

  it(`commentIds が ${COMMENT_IDS_MAX_COUNT} 要素を超えると reject する`, () => {
    const ids = Array.from({ length: COMMENT_IDS_MAX_COUNT + 1 }, (_, i) => `comment-${i}`);
    expect(CommentViewsRequestSchema.safeParse({ sessionId: "sess", commentIds: ids }).success).toBe(false);
  });

  it(`commentIds が ${COMMENT_IDS_MAX_COUNT} 要素ちょうどなら accept する`, () => {
    const ids = Array.from({ length: COMMENT_IDS_MAX_COUNT }, (_, i) => `comment-${i}`);
    expect(CommentViewsRequestSchema.safeParse({ sessionId: "sess", commentIds: ids }).success).toBe(true);
  });

  it("commentIds の要素が空文字だと reject する", () => {
    expect(
      CommentViewsRequestSchema.safeParse({ sessionId: "sess", commentIds: [""] }).success,
    ).toBe(false);
  });

  it("sessionId が欠落すると reject する", () => {
    expect(CommentViewsRequestSchema.safeParse({ commentIds: ["c1"] }).success).toBe(false);
  });
});

describe("WorkerRankingItemSchema", () => {
  const valid = {
    worker_id: "worker-1",
    display_name: "Worker Alpha",
    view_count: 42,
    vote_net_score: 10,
  };

  it("有効なアイテムをパースできる", () => {
    expect(WorkerRankingItemSchema.safeParse(valid).success).toBe(true);
  });

  it("view_count が負数だと reject する", () => {
    expect(WorkerRankingItemSchema.safeParse({ ...valid, view_count: -1 }).success).toBe(false);
  });

  it("vote_net_score は負数でも accept する（down vote で net マイナスはあり得る）", () => {
    expect(WorkerRankingItemSchema.safeParse({ ...valid, vote_net_score: -5 }).success).toBe(true);
  });
});
