import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dfCommandPath = path.join(repoRoot, ".claude", "commands", "df.md");
const workflowDocPath = path.join(repoRoot, "docs", "dark-factory-workflow.md");

function readDfCommand(): string {
  return readFileSync(dfCommandPath, "utf8");
}

function readWorkflowDoc(): string {
  return readFileSync(workflowDocPath, "utf8");
}

describe("/df コマンドファイルの存在 (受け入れ条件 #1)", () => {
  it(".claude/commands/df.md が存在する", () => {
    expect(existsSync(dfCommandPath)).toBe(true);
  });
});

describe("直近マイルストーン限定 (受け入れ条件 #1)", () => {
  it("自動選択を直近マイルストーンのみに限定することが明記されている", () => {
    const body = readDfCommand();
    // 直近マイルストーンのみを対象とする旨が記載されていること
    expect(body).toMatch(/直近マイルストーン.*のみ|直近.*(1つ|一つ|1件|絞り込み|限定)/s);
  });
});

describe("スキップ動作 (受け入れ条件 #2)", () => {
  it("直近マイルストーンに対象が無ければスキップ（フォールバックしない）ことが明記されている", () => {
    const body = readDfCommand();
    // スキップ・フォールバックしない旨が記載されていること
    expect(body).toMatch(/スキップ|フォールバック(しない|せず)/s);
  });

  it("他マイルストーンへフォールバックしない旨が明記されている", () => {
    const body = readDfCommand();
    expect(body).toMatch(/フォールバック(しない|せず)|他.*マイルストーン.*対象外/s);
  });
});

describe("引数あり挙動の維持 (受け入れ条件 #4)", () => {
  it("STEP 1-A（引数あり）はマイルストーン問わず対象とする旨が明記されている", () => {
    const body = readDfCommand();
    // 引数あり（$1 / STEP 1-A）はマイルストーンに関係なく対象とする旨
    expect(body).toMatch(/1-A|引数.*番号.*指定/s);
  });
});

describe("workflow.md との整合 (受け入れ条件 #5)", () => {
  it("docs/dark-factory-workflow.md が存在する", () => {
    expect(existsSync(workflowDocPath)).toBe(true);
  });

  it("workflow.md §3 が直近マイルストーン限定の新仕様と整合している", () => {
    const body = readWorkflowDoc();
    // 新仕様: 直近マイルストーンのみを対象とする旨が記載されていること
    expect(body).toMatch(/直近マイルストーン.*のみ|直近.*マイルストーン.*限定|直近.*マイルストーン.*対象/s);
  });

  it("workflow.md §3 の着手順説明がスキップ動作を含む新仕様を記述している", () => {
    const body = readWorkflowDoc();
    // 対象が無ければスキップする旨が記載されていること
    expect(body).toMatch(/スキップ|対象.*無け?れば.*終了/s);
  });
});
