import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const goalCommandPath = path.join(repoRoot, ".claude", "commands", "goal.md");

function readGoalCommand(): string {
  return readFileSync(goalCommandPath, "utf8");
}

describe("/goal コマンドファイルの存在 (受け入れ条件 #1)", () => {
  it(".claude/commands/goal.md が存在する", () => {
    expect(existsSync(goalCommandPath)).toBe(true);
  });
});

describe("フロントマター (受け入れ条件 #2)", () => {
  it("description フィールドが含まれる", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/^description:/m);
  });

  it("argument-hint フィールドが含まれる", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/^argument-hint:/m);
  });
});

describe("順次処理 (受け入れ条件 #3)", () => {
  it("pipeline() キーワードが含まれる", () => {
    const body = readGoalCommand();
    expect(body).toContain("pipeline()");
  });
});

describe("parallel 禁止 (受け入れ条件 #4)", () => {
  it("parallel() 禁止の記載がある", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/`parallel\(\)`.*禁止/);
  });
});

describe("安全ゲート (受け入れ条件 #5)", () => {
  it("main への操作禁止が明記される", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/main.*(禁止|禁|forbidden)/s);
  });

  it("CI 緑必須が明記される", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/CI.*(緑|green|必須)/s);
  });

  it("TDD かつ worktree の記載がある", () => {
    const body = readGoalCommand();
    expect(body).toContain("TDD");
    expect(body).toContain("worktree");
  });
});

describe("エラー隔離 (受け入れ条件 #6)", () => {
  it("blocked になっても次に進むエラー隔離が明記される", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/blocked.*になっても.*次.*進む/);
  });

  it("ブロックは df:* 状態ラベルに依存せず Issue コメント + マイルストーン解除で隔離する", () => {
    const body = readGoalCommand();
    // 廃止済みの df:* 状態ラベルを使わない
    expect(body).not.toContain("df:blocked");
    expect(body).not.toContain("df:todo");
    expect(body).not.toContain("df:dev-review");
    expect(body).not.toContain("df:done");
    // ブロック時はマイルストーン解除で自動選択対象外にする
    expect(body).toMatch(/マイルストーン.*解除/);
  });
});

describe("サマリ出力 (受け入れ条件 #7)", () => {
  it("処理済み・blocked・スキップのサマリ出力が明記される", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/サマリ|summary/i);
    expect(body).toMatch(/処理済み|completed/i);
    expect(body).toMatch(/blocked/i);
    expect(body).toMatch(/スキップ|skip/i);
  });
});

describe("マイルストーン絞り込み (受け入れ条件 #8)", () => {
  it("対象マイルストーン外の Issue は処理しないことが明記される", () => {
    const body = readGoalCommand();
    expect(body).toMatch(/マイルストーン.*(外|以外|対象外)/s);
  });
});
