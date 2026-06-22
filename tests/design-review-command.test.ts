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

describe("フロントマター (受け入れ条件 #2)", () => {
  it("description フィールドが含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/^description:/m);
  });
});

describe("タイポグラフィ階層チェック (受け入れ条件 #3)", () => {
  it("タイポグラフィ・フォントサイズ・ウェイトに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/タイポグラフィ|typography|フォントサイズ|font.?size|ウェイト|weight/i);
  });
});

describe("ホワイトスペース・8px グリッドチェック (受け入れ条件 #4)", () => {
  it("ホワイトスペースまたは 8px グリッドに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/ホワイトスペース|whitespace|8px|8 ?px グリッド/i);
  });
});

describe("カラー使用チェック (受け入れ条件 #5)", () => {
  it("カラー・色使いに関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/カラー|color|色使い|アクセント|コントラスト|contrast/i);
  });
});

describe("インタラクション状態チェック (受け入れ条件 #6)", () => {
  it("hover / focus / active / disabled の状態チェックが含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/hover/i);
    expect(body).toMatch(/focus/i);
    expect(body).toMatch(/active/i);
    expect(body).toMatch(/disabled/i);
  });
});

describe("空状態・ローディング状態チェック (受け入れ条件 #7)", () => {
  it("空状態またはローディング状態に関するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/空状態|ローディング|empty.?state|loading.?state/i);
  });
});

describe("CLAUDE.md デザインシステム整合性チェック (受け入れ条件 #8)", () => {
  it("CLAUDE.md のデザイン方針との整合を確認するチェック項目が含まれる", () => {
    const body = readCommand();
    expect(body).toMatch(/CLAUDE\.md|デザインシステム|design.?system/i);
  });
});

describe("/code-review との併用 (受け入れ条件 #9)", () => {
  it("既存の /code-review と併用できる（置き換えではない）旨が明記されている", () => {
    const body = readCommand();
    expect(body).toMatch(/\/code-review/);
    expect(body).toMatch(/補完|complement|置き換えではない|alongside/i);
  });
});

describe("UI 変更なし時の早期終了 (コマンド設計)", () => {
  it("server/ / common/ のみの変更の場合の UI 変更なし早期終了が明記されている", () => {
    const body = readCommand();
    expect(body).toMatch(/server.*common.*のみ|UI\s*変更\s*なし|ui\s*変更\s*なし/i);
  });
});
