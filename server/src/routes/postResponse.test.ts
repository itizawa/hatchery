import { describe, expect, it } from "vitest";

import { toCommentResponse, toPostResponse } from "./postResponse.js";
import type { CommentRecord } from "../persistence/commentRepository.js";
import type { PostRecord } from "../persistence/postRepository.js";

const basePost: PostRecord = {
  id: "post-1",
  communityId: "community-1",
  slotKey: "2026-06-10T09:00",
  seq: 0,
  author: "worker-1",
  title: "Title",
  text: "Body",
  score: 3,
  upCount: 0,
  createdAt: new Date("2026-06-10T09:00:00Z"),
};

const baseComment: CommentRecord = {
  id: "comment-1",
  communityId: "community-1",
  postId: "post-1",
  slotKey: "2026-06-10T09:00",
  seq: 0,
  author: "worker-2",
  text: "Reply",
  score: 1,
  upCount: 0,
  createdAt: new Date("2026-06-10T09:05:00Z"),
  parentCommentId: null,
};

describe("toPostResponse", () => {
  it("camelCase レコードを OpenAPI 契約（snake_case）のフィールド名へ整形する", () => {
    const res = toPostResponse(basePost);
    expect(res).toEqual({
      id: "post-1",
      community_id: "community-1",
      slot_key: "2026-06-10T09:00",
      seq: 0,
      author: "worker-1",
      title: "Title",
      text: "Body",
      score: 3,
      created_at: basePost.createdAt,
      comment_count: 0,
      up_count: 0,
    });
  });

  it("upCount を渡すと up_count として出力する（#814）", () => {
    const enriched = { ...basePost, upCount: 7 };
    const res = toPostResponse(enriched) as Record<string, unknown>;
    expect(res.up_count).toBe(7);
  });

  it("commentCount を渡すと comment_count として出力する（#500）", () => {
    const enriched = { ...basePost, commentCount: 7 };
    const res = toPostResponse(enriched) as Record<string, unknown>;
    expect(res.comment_count).toBe(7);
  });

  it("commentCount 省略時は comment_count=0（#500）", () => {
    const res = toPostResponse(basePost) as Record<string, unknown>;
    expect(res.comment_count).toBe(0);
  });

  it("camelCase キー（communityId / slotKey / createdAt）を含まない", () => {
    const res = toPostResponse(basePost) as Record<string, unknown>;
    expect(res).not.toHaveProperty("communityId");
    expect(res).not.toHaveProperty("slotKey");
    expect(res).not.toHaveProperty("createdAt");
  });

  it("author_worker が付与されたレコードは透過する", () => {
    const enriched = {
      ...basePost,
      author_worker: { id: "uuid-1", display_name: "haru", image_url: null },
    };
    const res = toPostResponse(enriched) as Record<string, unknown>;
    expect(res.author_worker).toEqual({ id: "uuid-1", display_name: "haru", image_url: null });
  });

  it("author_worker が無いレコードは author_worker を含めない", () => {
    const res = toPostResponse(basePost) as Record<string, unknown>;
    expect(res).not.toHaveProperty("author_worker");
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
});

describe("toCommentResponse", () => {
  it("camelCase レコードを OpenAPI 契約（snake_case・post_id を含む）へ整形する", () => {
    const res = toCommentResponse(baseComment);
    expect(res).toEqual({
      id: "comment-1",
      community_id: "community-1",
      post_id: "post-1",
      slot_key: "2026-06-10T09:00",
      seq: 0,
      author: "worker-2",
      text: "Reply",
      score: 1,
      created_at: baseComment.createdAt,
      parent_comment_id: null,
      up_count: 0,
    });
  });

  it("upCount を渡すと up_count として出力する（#814）", () => {
    const enriched = { ...baseComment, upCount: 5 };
    const res = toCommentResponse(enriched) as Record<string, unknown>;
    expect(res.up_count).toBe(5);
  });

  it("parentCommentId が設定されていると parent_comment_id として出力する（#520）", () => {
    const withParent = { ...baseComment, parentCommentId: "comment-parent" };
    const res = toCommentResponse(withParent) as Record<string, unknown>;
    expect(res.parent_comment_id).toBe("comment-parent");
  });

  it("camelCase キー（communityId / postId / slotKey / createdAt）を含まない", () => {
    const res = toCommentResponse(baseComment) as Record<string, unknown>;
    expect(res).not.toHaveProperty("communityId");
    expect(res).not.toHaveProperty("postId");
    expect(res).not.toHaveProperty("slotKey");
    expect(res).not.toHaveProperty("createdAt");
  });

  it("author_worker が付与されたレコードは透過する", () => {
    const enriched = {
      ...baseComment,
      author_worker: { id: "uuid-2", display_name: "ken", image_url: null },
    };
    const res = toCommentResponse(enriched) as Record<string, unknown>;
    expect(res.author_worker).toEqual({ id: "uuid-2", display_name: "ken", image_url: null });
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
});
