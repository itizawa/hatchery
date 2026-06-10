import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 受け入れ条件 #165: ロボットのドット絵 favicon (SVG) を設定する。
 * client/public/favicon.svg が自己完結したドット絵調 SVG として存在し、
 * index.html に SVG favicon の link が追加されていることを検証する。
 * Vitest は client パッケージを cwd として実行するため cwd 起点で読む。
 */
const faviconPath = resolve(process.cwd(), "public/favicon.svg");
const indexHtmlPath = resolve(process.cwd(), "index.html");

const favicon = readFileSync(faviconPath, "utf-8");
const html = readFileSync(indexHtmlPath, "utf-8");

describe("favicon.svg (#165)", () => {
  it("ルートが <svg> 要素で viewBox を持つ", () => {
    expect(favicon).toMatch(/<svg[^>]*\sviewBox="[^"]+"/);
  });

  it("ドット絵を構成する <rect> を複数含む", () => {
    const rectCount = (favicon.match(/<rect\b/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(2);
  });

  it("Slack 風テーマの配色（primary / 暗背景）を含む", () => {
    expect(favicon).toMatch(/#1164A3/i);
    expect(favicon).toMatch(/#26334D/i);
  });

  it("外部画像・フォント・スクリプトに依存しない（自己完結）", () => {
    expect(favicon).not.toMatch(/<image\b/);
    expect(favicon).not.toMatch(/<script\b/);
    expect(favicon).not.toMatch(/url\(/);
    expect(favicon).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
});

describe("index.html の favicon link (#165)", () => {
  it("SVG favicon の <link rel=\"icon\"> が追加されている", () => {
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/>/,
    );
  });
});
