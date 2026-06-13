import { describe, expect, it } from "vitest";

import { CommentSchema } from "./comment.js";

describe("CommentSchema", () => {
  const validComment = {
    id: "comment-1",
    community_id: "comm-1",
    post_id: "post-1",
    slot_key: "2026-06-10T09:00:00.000Z",
    seq: 0,
    author: "worker-ken",
    text: "それは大変だったね、お疲れ様",
    score: 0,
    created_at: new Date("2026-06-10T09:06:00.000Z"),
  };

  it("有効なコメントをパースできる", () => {
    const result = CommentSchema.safeParse(validComment);
    expect(result.success).toBe(true);
  });

  it("id を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.id).toBe("comment-1");
  });

  it("community_id を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.community_id).toBe("comm-1");
  });

  it("post_id を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.post_id).toBe("post-1");
  });

  it("slot_key を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.slot_key).toBe("2026-06-10T09:00:00.000Z");
  });

  it("seq を持つ（非負整数）", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.seq).toBe(0);
  });

  it("author（workerId）を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.author).toBe("worker-ken");
  });

  it("text を持つ（最大1000文字）", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.text).toBe("それは大変だったね、お疲れ様");
  });

  it("text が 1000 文字を超えると reject する", () => {
    const data = { ...validComment, text: "あ".repeat(1001) };
    expect(CommentSchema.safeParse(data).success).toBe(false);
  });

  it("score を持つ（非負整数）", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.score).toBe(0);
  });

  it("created_at を持つ", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("parent_comment_id を持たない（MVP はフラット）", () => {
    const result = CommentSchema.parse(validComment);
    expect("parent_comment_id" in result).toBe(false);
  });

  it("author_worker は任意で、省略しても有効（後方互換）", () => {
    const result = CommentSchema.parse(validComment);
    expect(result.author_worker).toBeUndefined();
  });

  it("author_worker を持てる（発言者の表示用ワーカー情報・#479）", () => {
    const result = CommentSchema.parse({
      ...validComment,
      author_worker: { id: "uuid-ken", display_name: "ken", image_url: null },
    });
    expect(result.author_worker).toEqual({
      id: "uuid-ken",
      display_name: "ken",
      image_url: null,
    });
  });
});
