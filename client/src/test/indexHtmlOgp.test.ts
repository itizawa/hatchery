import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 受け入れ条件 #256-1/2: index.html に共通 OGP メタタグが静的に追加されていることを検証する。
 * SPA（ADR-0003/0008）のため OGP は index.html 共通で全 URL 同一（ページ別 OGP はスコープ外）。
 * Vitest は client パッケージを cwd として実行するため、cwd 起点で index.html を読む。
 */
const indexHtmlPath = resolve(process.cwd(), "index.html");
const html = readFileSync(indexHtmlPath, "utf-8");

describe("index.html の共通 OGP メタタグ (#256)", () => {
  it("<html lang=\"ja\"> が維持されている", () => {
    expect(html).toMatch(/<html lang="ja">/);
  });

  it("<meta name=\"description\"> が追加されている", () => {
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
  });

  it("og:title が Hatchery で設定されている", () => {
    expect(html).toMatch(/<meta property="og:title" content="Hatchery"/);
  });

  it("og:description が設定されている", () => {
    expect(html).toMatch(/<meta property="og:description" content="[^"]+"/);
  });

  it("og:type が website で設定されている", () => {
    expect(html).toMatch(/<meta property="og:type" content="website"/);
  });

  it("og:url が VITE_OGP_URL の置換トークンで注入されている", () => {
    expect(html).toMatch(/<meta property="og:url" content="%VITE_OGP_URL%"/);
  });

  it("og:image が public 配下の静的画像を指している", () => {
    expect(html).toMatch(/<meta property="og:image" content="[^"]*\/ogp\.svg"/);
  });

  it("twitter:card が summary_large_image で設定されている", () => {
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
  });
});
