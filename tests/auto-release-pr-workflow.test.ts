import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "auto-release-pr.yml");

/** GitHub Actions ワークフローの最小構造（本テストで参照する範囲のみ）。 */
interface Workflow {
  on?: {
    push?: { branches?: string[] };
    workflow_dispatch?: unknown;
  };
  concurrency?: { group?: string } | string;
  permissions?: Record<string, string>;
  jobs?: Record<
    string,
    {
      "runs-on"?: string;
      steps?: Array<{
        uses?: string;
        run?: string;
        with?: Record<string, unknown>;
      }>;
    }
  >;
}

function loadWorkflow(): Workflow {
  return yaml.load(readFileSync(workflowPath, "utf8")) as Workflow;
}

/** 全ジョブのステップを 1 本に平坦化する（ジョブ名に依存せず要素の存在を見る）。 */
function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

/** 全ステップの run スクリプトを連結して返す。 */
function allRun(wf: Workflow): string {
  return allSteps(wf)
    .map((s) => s.run ?? "")
    .join("\n");
}

describe("auto-release-pr.yml (受け入れ条件 #1)", () => {
  it("YAML として妥当（パース可能）でマッピングを返す", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("トリガー定義 (受け入れ条件 #2, #3, #4)", () => {
  it("push の対象が develop に限定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches).toContain("develop");
  });

  it("workflow_dispatch（手動起動）が定義されている", () => {
    const wf = loadWorkflow();
    expect(wf.on).toHaveProperty("workflow_dispatch");
  });

  it("push トリガーは main を対象にしない（ゲート1整合）", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches ?? []).not.toContain("main");
  });
});

describe("権限 (受け入れ条件 #5)", () => {
  it("pull-requests: write が定義されている（PR 作成・更新に必要）", () => {
    const wf = loadWorkflow();
    expect(wf.permissions?.["pull-requests"]).toBe("write");
  });

  it("contents は write にしない（最小権限）", () => {
    const wf = loadWorkflow();
    expect(wf.permissions?.["contents"]).not.toBe("write");
  });
});

describe("リリース PR の向き / 冪等な作成・更新 (受け入れ条件 #6, #8)", () => {
  it("base: main / head: develop でリリース PR を作成する", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/--base\s+main\b/);
    expect(run).toMatch(/--head\s+develop\b/);
    expect(run).toMatch(/gh\s+pr\s+create\b/);
  });

  it("既存のオープン PR を検出する分岐（gh pr list）を持つ", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/gh\s+pr\s+list\b/);
  });
});

describe("マージしない (受け入れ条件 #7・ゲート1)", () => {
  it("どのステップでも PR をマージしない（gh pr merge を呼ばない）", () => {
    const run = allRun(loadWorkflow());
    expect(run).not.toMatch(/gh\s+pr\s+merge\b/);
    expect(run).not.toMatch(/\bpr\s+merge\b/);
  });
});

describe("差分ゼロ判定 (受け入れ条件 #9)", () => {
  it("main..develop の差分件数を判定する（rev-list）", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/rev-list/);
  });
});

describe("多重実行防止 (受け入れ条件 #10)", () => {
  it("concurrency.group が定義されている", () => {
    const wf = loadWorkflow();
    const group = typeof wf.concurrency === "string" ? wf.concurrency : wf.concurrency?.group;
    expect(group).toBeTruthy();
  });
});

describe("チェックアウト全履歴 (受け入れ条件 #11)", () => {
  it("actions/checkout を fetch-depth: 0 で実行する", () => {
    const steps = allSteps(loadWorkflow());
    const checkout = steps.find((s) => (s.uses ?? "").startsWith("actions/checkout"));
    expect(checkout, "actions/checkout ステップが存在する").toBeDefined();
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
  });
});
