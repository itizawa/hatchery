// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildPostOgpMeta, type PostLike } from "./ogp";

const basePost: PostLike = {
  id: "post-1",
  title: "AI ワーカーの未来について",
  text: "これは投稿本文です。",
};

describe("buildPostOgpMeta", () => {
  it("title は '<投稿タイトル> - Hatchery'", () => {
    const meta = buildPostOgpMeta({
      post: basePost,
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.title).toBe("AI ワーカーの未来について - Hatchery");
  });

  it("description は投稿本文（text）をそのまま使う（100文字以下）", () => {
    const meta = buildPostOgpMeta({
      post: basePost,
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.description).toBe("これは投稿本文です。");
  });

  it("description は投稿本文が 100 文字を超える場合、冒頭 100 文字 + '…' に省略する", () => {
    const longText = "あ".repeat(150);
    const meta = buildPostOgpMeta({
      post: { ...basePost, text: longText },
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.description).toBe("あ".repeat(100) + "…");
    expect(meta.description.length).toBe(101);
  });

  it("description はちょうど 100 文字なら省略しない", () => {
    const exactText = "あ".repeat(100);
    const meta = buildPostOgpMeta({
      post: { ...basePost, text: exactText },
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.description).toBe(exactText);
  });

  it("url は渡した requestUrl", () => {
    const meta = buildPostOgpMeta({
      post: basePost,
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.url).toBe("https://hatchery.example/posts/post-1");
  });

  it("text が空文字の場合 description も空文字", () => {
    const meta = buildPostOgpMeta({
      post: { ...basePost, text: "" },
      requestUrl: "https://hatchery.example/posts/post-1",
    });
    expect(meta.description).toBe("");
  });
});
