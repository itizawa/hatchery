import { describe, expect, it } from "vitest";
import { toPostResponse, toCommentResponse } from "./postResponse.js";
import type { PostRecord } from "../persistence/postRepository.js";
import type { CommentRecord } from "../persistence/commentRepository.js";

const basePost: PostRecord = {
  id: "post-1",
  communityId: "comm-1",
  slotKey: "2026-06-01T09:00",
  seq: 0,
  author: "worker-1",
  title: "テスト投稿",
  text: "本文",
  score: 3,
  createdAt: new Date("2026-06-01T09:00:00Z"),
  tags: [],
  isPinned: false,
  pinnedAt: null,
};

const baseComment: CommentRecord = {
  id: "comment-1",
  communityId: "comm-1",
  postId: "post-1",
  slotKey: "2026-06-01T09:00",
  seq: 0,
  author: "worker-2",
  text: "コメント本文",
  score: 1,
  createdAt: new Date("2026-06-01T09:01:00Z"),
  parentCommentId: null,
  isSummary: false,
};

describe("toPostResponse", () => {
  it("基本フィールドを返す", () => {
    const result = toPostResponse(basePost);
    expect(result.id).toBe("post-1");
    expect(result.community_id).toBe("comm-1");
    expect(result.score).toBe(3);
  });

  it("my_vote='up' のとき my_vote フィールドを含む（#831）", () => {
    const result = toPostResponse({ ...basePost, myVote: "up" });
    expect(result).toHaveProperty("my_vote", "up");
  });

  it("my_vote='down' のとき my_vote フィールドを含む（#831）", () => {
    const result = toPostResponse({ ...basePost, myVote: "down" });
    expect(result).toHaveProperty("my_vote", "down");
  });

  it("myVote=null のとき my_vote フィールドを含まない（#831）", () => {
    const result = toPostResponse({ ...basePost, myVote: null });
    expect(result).not.toHaveProperty("my_vote");
  });

  it("myVote 省略のとき my_vote フィールドを含まない（#831）", () => {
    const result = toPostResponse(basePost);
    expect(result).not.toHaveProperty("my_vote");
  });

  it("tags を含む（#1087）", () => {
    const result = toPostResponse({ ...basePost, tags: ["react", "vite"] });
    expect(result.tags).toEqual(["react", "vite"]);
  });

  it("tags 省略時は空配列を返す（#1087）", () => {
    const result = toPostResponse(basePost);
    expect(result.tags).toEqual([]);
  });

  it("is_pinned=true・pinned_at を ISO 文字列で返す（#1089）", () => {
    const pinnedAt = new Date("2026-07-11T00:00:00Z");
    const result = toPostResponse({ ...basePost, isPinned: true, pinnedAt });
    expect(result.is_pinned).toBe(true);
    expect(result.pinned_at).toBe("2026-07-11T00:00:00.000Z");
  });

  it("is_pinned=false・pinned_at=null を返す（未 pin・#1089）", () => {
    const result = toPostResponse(basePost);
    expect(result.is_pinned).toBe(false);
    expect(result.pinned_at).toBeNull();
  });
});

describe("toCommentResponse", () => {
  it("基本フィールドを返す", () => {
    const result = toCommentResponse(baseComment);
    expect(result.id).toBe("comment-1");
    expect(result.post_id).toBe("post-1");
    expect(result.score).toBe(1);
  });

  it("my_vote='up' のとき my_vote フィールドを含む（#831）", () => {
    const result = toCommentResponse({ ...baseComment, myVote: "up" });
    expect(result).toHaveProperty("my_vote", "up");
  });

  it("my_vote='down' のとき my_vote フィールドを含む（#831）", () => {
    const result = toCommentResponse({ ...baseComment, myVote: "down" });
    expect(result).toHaveProperty("my_vote", "down");
  });

  it("myVote=null のとき my_vote フィールドを含まない（#831）", () => {
    const result = toCommentResponse({ ...baseComment, myVote: null });
    expect(result).not.toHaveProperty("my_vote");
  });

  it("myVote 省略のとき my_vote フィールドを含まない（#831）", () => {
    const result = toCommentResponse(baseComment);
    expect(result).not.toHaveProperty("my_vote");
  });

  it("is_summary=false を返す（まとめコメント・#1165）", () => {
    const result = toCommentResponse(baseComment);
    expect(result.is_summary).toBe(false);
  });

  it("is_summary=true を返す（まとめコメント・#1165）", () => {
    const result = toCommentResponse({ ...baseComment, isSummary: true });
    expect(result.is_summary).toBe(true);
  });
});
