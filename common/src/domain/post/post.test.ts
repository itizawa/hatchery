import { describe, expect, it } from "vitest";

import { PostSchema } from "./post.js";

describe("PostSchema", () => {
  const validPost = {
    id: "post-1",
    community_id: "comm-1",
    slot_key: "2026-06-10T09:00:00.000Z",
    seq: 0,
    author: "worker-haru",
    title: "今日の仕事について",
    text: "今日はなんか変なバグに悩まされたよ",
    score: 0,
    created_at: new Date("2026-06-10T09:05:00.000Z"),
  };

  it("有効な投稿をパースできる", () => {
    const result = PostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it("id を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.id).toBe("post-1");
  });

  it("community_id を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.community_id).toBe("comm-1");
  });

  it("slot_key を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.slot_key).toBe("2026-06-10T09:00:00.000Z");
  });

  it("seq を持つ（非負整数）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.seq).toBe(0);
  });

  it("author（workerId）を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.author).toBe("worker-haru");
  });

  it("title を持つ（最大100文字）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.title).toBe("今日の仕事について");
  });

  it("title が 100 文字を超えると reject する", () => {
    const data = { ...validPost, title: "あ".repeat(101) };
    expect(PostSchema.safeParse(data).success).toBe(false);
  });

  it("text を持つ（最大1000文字）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.text).toBe("今日はなんか変なバグに悩まされたよ");
  });

  it("text が 1000 文字を超えると reject する", () => {
    const data = { ...validPost, text: "あ".repeat(1001) };
    expect(PostSchema.safeParse(data).success).toBe(false);
  });

  it("score を持つ（非負整数）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.score).toBe(0);
  });

  it("created_at を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("author_worker は任意で、省略しても有効（後方互換）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.author_worker).toBeUndefined();
  });

  it("author_worker を持てる（発言者の表示用ワーカー情報・#479）", () => {
    const result = PostSchema.parse({
      ...validPost,
      author_worker: { id: "uuid-haru", display_name: "haru", image_url: "https://example.com/haru.png" },
    });
    expect(result.author_worker).toEqual({
      id: "uuid-haru",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });
});
