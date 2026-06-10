import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 受け入れ条件 #259-1: client/public/robots.txt がクローラー向けに公開／非公開ページを通知する。
 * Vite は public/ 配下をビルド成果物のルートへ配置する（public/robots.txt → 本番 /robots.txt）。
 * Vitest は client パッケージを cwd として実行するため、cwd 起点で読む。
 */
const robotsPath = resolve(process.cwd(), "public/robots.txt");
const robots = readFileSync(robotsPath, "utf-8");

describe("client/public/robots.txt (#259)", () => {
  it("User-agent: * を含む", () => {
    expect(robots).toMatch(/^User-agent:\s*\*/m);
  });

  it("非公開パス /admin を Disallow する", () => {
    expect(robots).toMatch(/^Disallow:\s*\/admin/m);
  });

  it("非公開パス /account を Disallow する", () => {
    expect(robots).toMatch(/^Disallow:\s*\/account/m);
  });

  it("非公開パス /office を Disallow する", () => {
    expect(robots).toMatch(/^Disallow:\s*\/office/m);
  });

  it("Sitemap ディレクティブで sitemap.xml の絶対 URL を指定する", () => {
    expect(robots).toMatch(/^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml\s*$/m);
  });
});
