import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "release-tag.yml");

interface Workflow {
  on?: {
    pull_request?: {
      types?: string[];
      branches?: string[];
    };
    push?: unknown;
  };
  permissions?: Record<string, string>;
  jobs?: Record<
    string,
    {
      if?: string;
      "runs-on"?: string;
      steps?: Array<{
        uses?: string;
        run?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
      }>;
    }
  >;
}

function loadWorkflow(): Workflow {
  return yaml.load(readFileSync(workflowPath, "utf8")) as Workflow;
}

function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

function allRun(wf: Workflow): string {
  return allSteps(wf)
    .map((s) => s.run ?? "")
    .join("\n");
}

describe("release-tag.yml ファイル基本チェック (受け入れ条件 #2)", () => {
  it("YAML として妥当（パース可能）でマッピングを返す", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });

  it("pull_request closed イベントをトリガーにする", () => {
    const wf = loadWorkflow();
    expect(wf.on?.pull_request?.types).toContain("closed");
  });

  it("base ブランチが main に限定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.pull_request?.branches).toContain("main");
  });

  it("develop への直接 push はトリガーにしない（ブランチ場定は auto-release-pr.yml の担当）", () => {
    const wf = loadWorkflow();
    const onKeys = Object.keys(wf.on ?? {});
    expect(onKeys).not.toContain("push");
  });
});

describe("実行条件 (受け入れ条件 #2)", () => {
  it("merged == true かつ head が develop の場合のみ実行する条件を持つ", () => {
    const wf = loadWorkflow();
    const jobs = Object.values(wf.jobs ?? {});
    const hasCondition = jobs.some(
      (job) =>
        (job.if ?? "").includes("merged") &&
        (job.if ?? "").includes("develop"),
    );
    expect(hasCondition).toBe(true);
  });
});

describe("権限 (受け入れ条件 #3)", () => {
  it("contents: write が定義されている（タグ・ Release 作成に必要）", () => {
    const wf = loadWorkflow();
    expect(wf.permissions?.["contents"]).toBe("write");
  });

  it("pull-requests: write は定義しない（PR を操作しないため最小権限）", () => {
    const wf = loadWorkflow();
    expect(wf.permissions?.["pull-requests"]).toBeUndefined();
  });
});

describe("バージョン抜出とタグ作成 (受け入れ条件 #2, #4)", () => {
  it("vX.Y.Z 形式のバージョン抜出ロジックを持つ", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/v\[0-9\]/);
  });

  it("git tag を作成してリモートに push する", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/git\s+tag\b/);
    expect(run).toMatch(/git\s+push\s+origin\b/);
  });

  it("gh release create でリリースを作成する", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/gh\s+release\s+create\b/);
  });

  it("リリースノートを生成して Release に含める（git log）", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/git\s+log\b/);
  });
});

describe("冪等性 (受け入れ条件 #5)", () => {
  it("バージョン抜出失敗時に正常終了（exit 0）でスキップする", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/exit\s+0/);
  });

  it("同名タグが既に存在する場合にスキップするロジックを持つ（2 箇所以上の exit 0）", () => {
    const run = allRun(loadWorkflow());
    const exitZeroCount = (run.match(/exit\s+0/g) ?? []).length;
    expect(exitZeroCount).toBeGreaterThanOrEqual(2);
  });
});

describe("PR を作成・マージしない (ゲート1, 受け入れ条件 #6)", () => {
  it("gh pr create を呼ばない", () => {
    const run = allRun(loadWorkflow());
    expect(run).not.toMatch(/gh\s+pr\s+create\b/);
  });

  it("gh pr merge を呼ばない", () => {
    const run = allRun(loadWorkflow());
    expect(run).not.toMatch(/gh\s+pr\s+merge\b/);
  });
});

describe("pnpm バナー抑制 (受け入れ条件 #4)", () => {
  it("release-notes の pnpm 実行に --silent フラグが含まれる（stdout バナー混入防止）", () => {
    const run = allRun(loadWorkflow());
    expect(run).toMatch(/pnpm\s+(?:--silent|-s)\b[^#]*release-notes/s);
  });
});
