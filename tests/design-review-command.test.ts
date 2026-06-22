import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandPath = path.join(repoRoot, ".claude", "commands", "design-review.md");

function readCommand(): string {
  return readFileSync(commandPath, "utf8");
}

describe("/design-review コマンドファイルの存在 (受け入れ条件 #1)", () => {
  it(".claude/commands/design-review.md が存在する", () => {
    expect(existsSync(commandPath)).toBe(true);
  });
});

describe("フロントマター (受け入れ条件 #1)", () => {
  it("description フィールドが含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/^description:/m);
  });
});

describe("タイポグラフィ階層チェック (受け入れ条件 #2)", () => {
  it("タイポグラフィ・フォントサイズ・ウェイトに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/タイポグラフィ|typography|フォントサイズ|font.?size|ウェイト|weight/i);
  });
});

describe("ホワイトスペース・8px グリッドチェック (受け入れ条件 #2)", () => {
  it("ホワイトスペースまたは 8px グリッドに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/ホワイトスペース|whitespace|8px|8 ?px グリッド/i);
  });
});

describe("カラー使用チェック (受け入れ条件 #2)", () => {
  it("カラー・色使いに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/カラー|color|色使い|アクセント|コントラスト|contrast/i);
  });
});

describe("インタラクション状態チェック (受け入れ条件 #2)", () => {
  it("hover / focus / active / disabled の状態チェックが含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/hover/i);
    expect(body).toMatch(/focus/i);
    expect(body).toMatch(/active|disabled/i);
  });
});

describe("空状態・ローディング状態チェック (受け入れ条件 #2)", () => {
  it("空状態またはローディング状態に関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/空状態|ローディング|empty.?state|loading.?state/i);
  });
});

describe("CLAUDE.md デザインシステム整合性チェック (受け入れ条件 #2)", () => {
  it("CLAUDE.md のデザイン方針との整合を確認するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/CLAUDE\.md|デザインシステム|design.?system/i);
  });
});

describe("/code-review との併用 (受け入れ条件 #3)", () => {
  it("既存の /code-review と併用できる（置き換えではない）旨が明記されている", () => {
    const body = readCommand();
    expect(body).toMatch(/code.?review|コードレビュー/i);
    expect(body).toMatch(/併用|追加|補完|complement|alongside/i);
  });
});
