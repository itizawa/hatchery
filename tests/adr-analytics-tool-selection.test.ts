import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adrDir = path.join(repoRoot, "docs", "adr");

function findAdr0026(): string {
  const matches = readdirSync(adrDir).filter((f) => /^0026-.*\.md$/.test(f));
  expect(matches, "docs/adr に 0026-*.md が 1 件だけ存在する").toHaveLength(1);
  return path.join(adrDir, matches[0]);
}

function adrBody(): string {
  return readFileSync(findAdr0026(), "utf8");
}

describe("ADR-0026 ファイルの体裁 (受け入れ条件 #1, #3)", () => {
  it("先頭メタ（ステータス / 日付 / 関連 Issue #235）を持つ", () => {
    const body = adrBody();
    expect(body).toMatch(/ステータス:\s*Accepted/);
    expect(body).toMatch(/日付:/);
    expect(body).toMatch(/関連 Issue:\s*#?235/);
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

describe("採用ツールの決定 (受け入れ条件 #3)", () => {
  it("Cloudflare Web Analytics が決定として記録されている", () => {
    const body = adrBody();
    expect(body).toMatch(/Cloudflare Web Analytics/);
  });
});

describe("代替案の比較 (受け入れ条件 #2)", () => {
  it("検討した代替案に Google Analytics が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/Google Analytics/);
  });

  it("検討した代替案に Plausible が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/Plausible/);
  });

  it("検討した代替案に Umami または PostHog が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/Umami|PostHog/);
  });
});

describe("比較軸の記載 (受け入れ条件 #2)", () => {
  it("SPA / ルート遷移計測の観点が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/SPA/);
  });

  it("プライバシー / Cookie / GDPR の観点が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/Cookie/);
    expect(body).toMatch(/GDPR/);
  });

  it("コストの観点が含まれる", () => {
    const body = adrBody();
    expect(body).toMatch(/コスト|無料/);
  });
});

describe("実装スコープの制限 (受け入れ条件 #5)", () => {
  it("ADR は技術選定のみであり、実装は別 Issue とする旨が明記されている", () => {
    const body = adrBody();
    expect(body).toMatch(/別.*Issue|後続.*Issue|別途/);
  });
});

describe("README 一覧への追記 (受け入れ条件 #4)", () => {
  it("docs/adr/README.md に 0026 の行（ファイルリンク付き）がある", () => {
    const readme = readFileSync(path.join(adrDir, "README.md"), "utf8");
    expect(readme).toMatch(/\[0026\]\(\.\/0026-[^)]+\.md\)/);
  });
});
