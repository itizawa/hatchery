import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adrDir = path.join(repoRoot, "docs", "adr");

function findAdr0014(): string {
  const matches = readdirSync(adrDir).filter((f) => /^0014-.*\.md$/.test(f));
  expect(matches, "docs/adr に 0014-*.md が 1 件だけ存在する").toHaveLength(1);
  return path.join(adrDir, matches[0]);
}

function adrBody(): string {
  return readFileSync(findAdr0014(), "utf8");
}

describe("ADR-0014 ファイルの体裁 (受け入れ条件 #1-2)", () => {
  it("先頭メタ（ステータス / 日付 / 関連 Issue）を持つ", () => {
    const body = adrBody();
    expect(body).toMatch(/ステータス:\s*Accepted/);
    expect(body).toMatch(/日付:/);
    expect(body).toMatch(/関連 Issue:\s*#169/);
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

describe("ABAC 採用の決定記録 (受け入れ条件 #2)", () => {
  it("ABAC が決定として記録されている", () => {
    const body = adrBody();
    expect(body).toMatch(/ABAC/);
  });

  it("属性モデル（subject / resource / action）が定義されている", () => {
    const body = adrBody();
    expect(body).toMatch(/subject/);
    expect(body).toMatch(/resource/);
    expect(body).toMatch(/action/);
  });

  it("ポリシー評価の置き場として common 純粋関数に言及している", () => {
    const body = adrBody();
    expect(body).toMatch(/common/);
  });

  it("現行 RBAC からの移行方針（isAdmin）に言及している", () => {
    const body = adrBody();
    expect(body).toMatch(/isAdmin/);
    expect(body).toMatch(/RBAC|ロールベース/);
  });

  it("本人限定ポリシー例（ownerId）に言及している", () => {
    const body = adrBody();
    expect(body).toMatch(/ownerId/);
  });

  it("ADR-0010 に言及している（関連 ADR: 認証）", () => {
    const body = adrBody();
    expect(body).toMatch(/ADR-0010/);
  });
});

describe("README 一覧への追記 (受け入れ条件 #3)", () => {
  it("docs/adr/README.md に 0014 の行（ファイルリンク付き）がある", () => {
    const readme = readFileSync(path.join(adrDir, "README.md"), "utf8");
    expect(readme).toMatch(/\[0014\]\(\.\/0014-[^)]+\.md\)/);
  });
});
