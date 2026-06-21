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
  upCount: 5,
  createdAt: new Date("2026-06-01T09:00:00Z"),
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
  upCount: 2,
  createdAt: new Date("2026-06-01T09:01:00Z"),
  parentCommentId: null,
};

describe("toPostResponse", () => {
  it("基本フィールドを返す", () => {
    const result = toPostResponse(basePost);
    expect(result.id).toBe("post-1");
    expect(result.community_id).toBe("comm-1");
    expect(result.score).toBe(3);
  });

  it("up_count を返す（#814）", () => {
    const result = toPostResponse(basePost);
    expect(result.up_count).toBe(5);
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
  it("基本フィールドを返す", () => {
    const result = toCommentResponse(baseComment);
    expect(result.id).toBe("comment-1");
    expect(result.post_id).toBe("post-1");
    expect(result.score).toBe(1);
  });

  it("up_count を返す（#814）", () => {
    const result = toCommentResponse(baseComment);
    expect(result.up_count).toBe(2);
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
