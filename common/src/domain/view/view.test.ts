import { describe, expect, it } from "vitest";

import { COMMUNITY_SLUG_MAX_LENGTH } from "../community/community.js";
import { WORKER_IMAGE_URL_MAX_LENGTH } from "../worker/worker.js";
import {
  CommentViewsRequestSchema,
  COMMENT_IDS_MAX_COUNT,
  PostViewRequestSchema,
  SESSION_ID_MAX_LENGTH,
  TrendingItemSchema,
  TRENDING_ITEM_EXCERPT_MAX_LENGTH,
  TRENDING_ITEM_ID_MAX_LENGTH,
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
    // eslint-disable-next-line max-params
    const ids = Array.from({ length: COMMENT_IDS_MAX_COUNT + 1 }, (_, i) => `comment-${i}`);
    expect(CommentViewsRequestSchema.safeParse({ sessionId: "sess", commentIds: ids }).success).toBe(false);
  });

  it(`commentIds が ${COMMENT_IDS_MAX_COUNT} 要素ちょうどなら accept する`, () => {
    // eslint-disable-next-line max-params
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
    image_url: null,
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

  it("image_url が null でも accept する", () => {
    expect(WorkerRankingItemSchema.safeParse({ ...valid, image_url: null }).success).toBe(true);
  });

  it("image_url が有効な URL 文字列なら accept する", () => {
    expect(
      WorkerRankingItemSchema.safeParse({ ...valid, image_url: "https://example.com/img.png" }).success,
    ).toBe(true);
  });

  it(`image_url が ${WORKER_IMAGE_URL_MAX_LENGTH} 文字を超える URL だと reject する`, () => {
    const longPath = "a".repeat(WORKER_IMAGE_URL_MAX_LENGTH);
    expect(
      WorkerRankingItemSchema.safeParse({ ...valid, image_url: `https://example.com/${longPath}` }).success,
    ).toBe(false);
  });

  it("image_url フィールドが欠落すると reject する", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image_url: _imageUrl, ...withoutImageUrl } = valid;
    expect(WorkerRankingItemSchema.safeParse(withoutImageUrl).success).toBe(false);
  });
});

describe("TrendingItemSchema（#1065）", () => {
  const validPost = {
    type: "post" as const,
    id: "post-1",
    post_id: "post-1",
    excerpt: "本文冒頭のプレビュー",
    community_id: "community-1",
    community_slug: "technology",
    net_score: 12,
    created_at: "2026-07-01T09:00:00.000Z",
  };

  const validComment = {
    type: "comment" as const,
    id: "comment-1",
    post_id: "post-1",
    excerpt: "コメント本文冒頭のプレビュー",
    community_id: "community-1",
    community_slug: "technology",
    net_score: -3,
    created_at: "2026-07-02T09:00:00.000Z",
  };

  it("有効な post アイテムをパースできる", () => {
    expect(TrendingItemSchema.safeParse(validPost).success).toBe(true);
  });

  it("有効な comment アイテムをパースできる（post_id が自身の id と異なる）", () => {
    expect(TrendingItemSchema.safeParse(validComment).success).toBe(true);
  });

  it("net_score は負数でも accept する（down vote 優勢であり得る）", () => {
    expect(TrendingItemSchema.safeParse({ ...validPost, net_score: -1 }).success).toBe(true);
  });

  it("type が post/comment 以外だと reject する", () => {
    expect(TrendingItemSchema.safeParse({ ...validPost, type: "worker" }).success).toBe(false);
  });

  it("type フィールドが欠落すると reject する", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _type, ...withoutType } = validPost;
    expect(TrendingItemSchema.safeParse(withoutType).success).toBe(false);
  });

  it("created_at が ISO8601 datetime でない文字列だと reject する", () => {
    expect(TrendingItemSchema.safeParse({ ...validPost, created_at: "2026/07/01" }).success).toBe(false);
  });

  it(`excerpt が ${TRENDING_ITEM_EXCERPT_MAX_LENGTH} 文字ちょうどなら accept する`, () => {
    const exact = "あ".repeat(TRENDING_ITEM_EXCERPT_MAX_LENGTH);
    expect(TrendingItemSchema.safeParse({ ...validPost, excerpt: exact }).success).toBe(true);
  });

  it(`excerpt が ${TRENDING_ITEM_EXCERPT_MAX_LENGTH} 文字を超えると reject する`, () => {
    const long = "あ".repeat(TRENDING_ITEM_EXCERPT_MAX_LENGTH + 1);
    expect(TrendingItemSchema.safeParse({ ...validPost, excerpt: long }).success).toBe(false);
  });

  it(`community_slug が ${COMMUNITY_SLUG_MAX_LENGTH} 文字を超えると reject する`, () => {
    const longSlug = "a".repeat(COMMUNITY_SLUG_MAX_LENGTH + 1);
    expect(TrendingItemSchema.safeParse({ ...validPost, community_slug: longSlug }).success).toBe(false);
  });

  it(`id が ${TRENDING_ITEM_ID_MAX_LENGTH} 文字を超えると reject する`, () => {
    const longId = "a".repeat(TRENDING_ITEM_ID_MAX_LENGTH + 1);
    expect(TrendingItemSchema.safeParse({ ...validPost, id: longId }).success).toBe(false);
  });

  it(`post_id が ${TRENDING_ITEM_ID_MAX_LENGTH} 文字を超えると reject する`, () => {
    const longPostId = "a".repeat(TRENDING_ITEM_ID_MAX_LENGTH + 1);
    expect(TrendingItemSchema.safeParse({ ...validPost, post_id: longPostId }).success).toBe(false);
  });

  it(`id が ${TRENDING_ITEM_ID_MAX_LENGTH} 文字を超えると community も含め reject する（comment 側でも検証）`, () => {
    const longId = "a".repeat(TRENDING_ITEM_ID_MAX_LENGTH + 1);
    expect(TrendingItemSchema.safeParse({ ...validComment, community_id: longId }).success).toBe(false);
  });
});
