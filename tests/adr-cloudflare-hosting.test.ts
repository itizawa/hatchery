import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adrDir = path.join(repoRoot, "docs", "adr");

/** docs/adr 配下の 0008-*.md を 1 件だけ解決する（連番採番のブレに耐える）。 */
function findAdr0008(): string {
  const matches = readdirSync(adrDir).filter((f) => /^0008-.*\.md$/.test(f));
  expect(matches, "docs/adr に 0008-*.md が 1 件だけ存在する").toHaveLength(1);
  return path.join(adrDir, matches[0]);
}

function adrBody(): string {
  return readFileSync(findAdr0008(), "utf8");
}

describe("ADR-0008 ファイルの体裁 (受け入れ条件 #1)", () => {
  it("先頭メタ（ステータス / 日付 / 関連 Issue #19）を持つ", () => {
    const body = adrBody();
    expect(body).toMatch(/ステータス:/);
    expect(body).toMatch(/日付:/);
    expect(body).toMatch(/関連 Issue:\s*#?19/);
  });

  it("MADR の必須セクション見出しをすべて含む", () => {
    const body = adrBody();
    for (const heading of [
      "## コンテキスト（背景）",
      "## 決定",
      "## 理由",
      "## 検討した代替案",
      "## 影響（結果）",
    ]) {
      expect(body, `見出し「${heading}」を含む`).toContain(heading);
    }
  });
});

describe("ホスティング先の決定 (受け入れ条件 #2)", () => {
  it("Cloudflare Pages が決定として記録されている", () => {
    const body = adrBody();
    expect(body).toMatch(/Cloudflare Pages/);
  });
});

describe("ページ毎 OGP の方針 (受け入れ条件 #3)", () => {
  it("OGP の制約と HTMLRewriter / Pages Functions による後付け方針を含む", () => {
    const body = adrBody();
    expect(body).toMatch(/OGP/);
    expect(body).toMatch(/HTMLRewriter/);
    expect(body).toMatch(/Pages Functions/);
  });
});

describe("ADR-0003 との関係 (受け入れ条件 #4)", () => {
  it("ADR-0003 に言及し SSR なし SPA を維持する旨を含む", () => {
    const body = adrBody();
    expect(body).toMatch(/ADR-0003/);
    expect(body).toMatch(/SSR/);
    expect(body).toMatch(/SPA/);
  });
});

describe("検討した代替案 (受け入れ条件 #6)", () => {
  it("Vercel / Netlify の自動プリレンダリングと SSR/SSG 移行が比較されている", () => {
    const body = adrBody();
    expect(body).toMatch(/Vercel/);
    expect(body).toMatch(/Netlify/);
    expect(body).toMatch(/SSG/);
  });
});

describe("README 一覧への追記 (受け入れ条件 #5)", () => {
  it("docs/adr/README.md に 0008 の行（ファイルリンク付き）がある", () => {
    const readme = readFileSync(path.join(adrDir, "README.md"), "utf8");
    expect(readme).toMatch(/\[0008\]\(\.\/0008-[^)]+\.md\)/);
  });
});
