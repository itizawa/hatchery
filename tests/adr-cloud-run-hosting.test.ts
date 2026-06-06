import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adrDir = path.join(repoRoot, "docs", "adr");

function findAdr0011(): string {
  const matches = readdirSync(adrDir).filter((f) => /^0011-.*\.md$/.test(f));
  expect(matches, "docs/adr に 0011-*.md が 1 件だけ存在する").toHaveLength(1);
  return path.join(adrDir, matches[0]);
}

function adrBody(): string {
  return readFileSync(findAdr0011(), "utf8");
}

describe("ADR-0011 ファイルの体裁 (受け入れ条件 #7)", () => {
  it("先頭メタ（ステータス / 日付 / 関連 Issue）を持つ", () => {
    const body = adrBody();
    expect(body).toMatch(/ステータス:/);
    expect(body).toMatch(/日付:/);
    expect(body).toMatch(/関連 Issue:\s*#?78/);
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

describe("Cloud Run 採用の決定記録 (受け入れ条件 #7)", () => {
  it("Cloud Run が決定として記録されている", () => {
    const body = adrBody();
    expect(body).toMatch(/Cloud Run/);
  });

  it("Cloudflare Pages のクライアントホスティングに言及している", () => {
    const body = adrBody();
    expect(body).toContain("Cloudflare Pages");
  });

  it("ADR-0008 に言及している（関連 ADR）", () => {
    const body = adrBody();
    expect(body).toMatch(/ADR-0008/);
  });
});

describe("README 一覧への追記 (受け入れ条件 #8)", () => {
  it("docs/adr/README.md に 0011 の行（ファイルリンク付き）がある", () => {
    const readme = readFileSync(path.join(adrDir, "README.md"), "utf8");
    expect(readme).toMatch(/\[0011\]\(\.\/0011-[^)]+\.md\)/);
  });
});
