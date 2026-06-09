import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adrDir = path.join(repoRoot, "docs", "adr");

function findAdr0013(): string {
  const matches = readdirSync(adrDir).filter((f) => /^0013-.*\.md$/.test(f));
  expect(matches, "docs/adr に 0013-*.md が 1 件だけ存在する").toHaveLength(1);
  return path.join(adrDir, matches[0]);
}

function adrBody(): string {
  return readFileSync(findAdr0013(), "utf8");
}

describe("ADR-0013 ファイルの体裁 (受け入れ条件 #6)", () => {
  it("先頭メタ（ステータス / 日付 / 関連 Issue）を持つ", () => {
    const body = adrBody();
    expect(body).toMatch(/ステータス:/);
    expect(body).toMatch(/日付:/);
    expect(body).toMatch(/関連 Issue:\s*#?148/);
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

describe("Renovate 採用の決定記録 (受け入れ条件 #6)", () => {
  it("Renovate が決定として記録されている", () => {
    const body = adrBody();
    expect(body).toMatch(/Renovate/);
  });

  it("minimumReleaseAge に言及している（クールダウン機能の根拠）", () => {
    const body = adrBody();
    expect(body).toMatch(/minimumReleaseAge/);
  });

  it("7 日のクールダウン根拠が記載されている", () => {
    const body = adrBody();
    expect(body).toMatch(/7\s*日/);
  });

  it("develop ターゲットに言及している（ブランチ戦略整合）", () => {
    const body = adrBody();
    expect(body).toMatch(/develop/);
  });

  it("ADR-0002 に言及している（関連 ADR: pnpm 選定）", () => {
    const body = adrBody();
    expect(body).toMatch(/ADR-0002/);
  });
});

describe("README 一覧への追記 (受け入れ条件 #6)", () => {
  it("docs/adr/README.md に 0013 の行（ファイルリンク付き）がある", () => {
    const readme = readFileSync(path.join(adrDir, "README.md"), "utf8");
    expect(readme).toMatch(/\[0013\]\(\.\/0013-[^)]+\.md\)/);
  });
});

// --- Issue #149: automerge 運用ポリシーの ADR 記録 ---

describe("automerge ポリシーの ADR 記録 (受け入れ条件 #6 - Issue #149)", () => {
  it("ADR-0013 に automerge への言及がある", () => {
    const body = adrBody();
    expect(body).toMatch(/automerge/);
  });

  it("devDependencies の automerge が明記されている", () => {
    const body = adrBody();
    expect(body).toMatch(/devDependencies/);
  });

  it("dependencyDashboard に言及している（PR 溜まり防止の仕組み）", () => {
    const body = adrBody();
    expect(body).toMatch(/dependencyDashboard/);
  });
});
