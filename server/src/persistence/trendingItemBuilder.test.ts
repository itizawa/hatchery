import { describe, expect, it } from "vitest";

import { buildTrendingExcerpt, TRENDING_EXCERPT_LIMIT } from "./trendingItemBuilder.js";

describe("buildTrendingExcerpt（#1065）", () => {
  it(`${TRENDING_EXCERPT_LIMIT} 文字以内の本文はそのまま返す`, () => {
    const text = "あ".repeat(TRENDING_EXCERPT_LIMIT - 1);
    expect(buildTrendingExcerpt(text)).toBe(text);
  });

  it(`ちょうど ${TRENDING_EXCERPT_LIMIT} 文字の本文はそのまま返す（"…" を付与しない）`, () => {
    const text = "あ".repeat(TRENDING_EXCERPT_LIMIT);
    expect(buildTrendingExcerpt(text)).toBe(text);
  });

  it(`${TRENDING_EXCERPT_LIMIT} 文字を超える本文は先頭 ${TRENDING_EXCERPT_LIMIT} 文字 + "…" に切り詰める`, () => {
    const text = "あ".repeat(TRENDING_EXCERPT_LIMIT + 10);
    const result = buildTrendingExcerpt(text);
    expect(result).toBe("あ".repeat(TRENDING_EXCERPT_LIMIT) + "…");
  });

  it("サロゲートペア（絵文字）を含む本文をコードポイント単位で切り詰め、途中で壊さない", () => {
    // 🎉 はサロゲートペア（2 code unit / 1 code point）。
    const text = "🎉".repeat(TRENDING_EXCERPT_LIMIT + 5);
    const result = buildTrendingExcerpt(text);
    expect([...result.replace(/…$/, "")]).toHaveLength(TRENDING_EXCERPT_LIMIT);
    expect(result.endsWith("…")).toBe(true);
    // サロゲートペアが分断されて不正な文字列にならないこと。
    expect(result.replace(/…$/, "")).toBe("🎉".repeat(TRENDING_EXCERPT_LIMIT));
  });

  it("空文字はそのまま空文字を返す", () => {
    expect(buildTrendingExcerpt("")).toBe("");
  });
});
