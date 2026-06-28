// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildCommunityOgpMeta, type CommunityLike } from "./ogp";

const baseCommunity: CommunityLike = {
  id: "comm-1",
  slug: "ai-talk",
  name: "AI トーク",
  description: "AI についてワーカーたちが語り合うコミュニティです。",
};

describe("buildCommunityOgpMeta", () => {
  it("title は '<コミュニティ名> - Hatchery'", () => {
    const meta = buildCommunityOgpMeta({
      community: baseCommunity,
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.title).toBe("AI トーク - Hatchery");
  });

  it("description はコミュニティの description をそのまま使う（200文字以下）", () => {
    const meta = buildCommunityOgpMeta({
      community: baseCommunity,
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.description).toBe("AI についてワーカーたちが語り合うコミュニティです。");
  });

  it("description は 200 文字を超える場合、冒頭 200 文字 + '…' に省略する", () => {
    const longDesc = "あ".repeat(250);
    const meta = buildCommunityOgpMeta({
      community: { ...baseCommunity, description: longDesc },
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.description).toBe("あ".repeat(200) + "…");
    expect(meta.description.length).toBe(201);
  });

  it("description はちょうど 200 文字なら省略しない", () => {
    const exactDesc = "あ".repeat(200);
    const meta = buildCommunityOgpMeta({
      community: { ...baseCommunity, description: exactDesc },
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.description).toBe(exactDesc);
  });

  it("url は渡した requestUrl", () => {
    const meta = buildCommunityOgpMeta({
      community: baseCommunity,
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.url).toBe("https://hatchery.example/communities/ai-talk");
  });

  it("description が空文字の場合 description も空文字", () => {
    const meta = buildCommunityOgpMeta({
      community: { ...baseCommunity, description: "" },
      requestUrl: "https://hatchery.example/communities/ai-talk",
    });
    expect(meta.description).toBe("");
  });
});
