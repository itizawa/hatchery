import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ciPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

/** GitHub Actions ワークフローの最小構造（本テストで参照する範囲のみ）。 */
interface Workflow {
  on?: {
    pull_request?: { branches?: string[] };
    push?: { branches?: string[] };
  };
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

function readRaw(): string {
  return readFileSync(ciPath, "utf8");
}

function loadWorkflow(): Workflow {
  return yaml.load(readRaw()) as Workflow;
}

/** 全ジョブのステップを 1 本に平坦化する（ジョブ名に依存せず要素の存在を見る）。 */
function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe("CI ワークフロー ci.yml (受け入れ条件 #1)", () => {
  it("YAML として妥当（パース可能）でマッピングを返す", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("トリガー定義 (受け入れ条件 #2, #10)", () => {
  it("pull_request の base が develop に限定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.pull_request?.branches).toContain("develop");
  });

  it("push の対象が develop に限定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches).toContain("develop");
  });

  it("pull_request / push のトリガーは main を対象にしない（ゲート1整合）", () => {
    const wf = loadWorkflow();
    expect(wf.on?.pull_request?.branches ?? []).not.toContain("main");
    expect(wf.on?.push?.branches ?? []).not.toContain("main");
  });
});

describe("ジョブのステップ定義 (受け入れ条件 #3, #4, #5, #6)", () => {
  it("pnpm/action-setup で pnpm をセットアップする", () => {
    const steps = allSteps(loadWorkflow());
    expect(steps.some((s) => (s.uses ?? "").startsWith("pnpm/action-setup"))).toBe(true);
  });

  it("actions/setup-node が node-version-file: .nvmrc を参照する（バージョンをハードコードしない）", () => {
    const steps = allSteps(loadWorkflow());
    const setupNode = steps.find((s) => (s.uses ?? "").startsWith("actions/setup-node"));
    expect(setupNode, "actions/setup-node ステップが存在する").toBeDefined();
    expect(setupNode?.with?.["node-version-file"]).toBe(".nvmrc");
    // バージョンを直接書かない（.nvmrc 単一情報源）
    expect(setupNode?.with?.["node-version"]).toBeUndefined();
  });

  it("pnpm install --frozen-lockfile を実行する", () => {
    const steps = allSteps(loadWorkflow());
    expect(
      steps.some(
        (s) => /pnpm\s+install\b/.test(s.run ?? "") && /--frozen-lockfile/.test(s.run ?? ""),
      ),
    ).toBe(true);
  });

  it("turbo run で lint・test・build をすべて実行する", () => {
    const steps = allSteps(loadWorkflow());
    const turboRun = steps.find((s) => /turbo\s+run\b/.test(s.run ?? ""));
    expect(turboRun, "turbo run ステップが存在する").toBeDefined();
    const run = turboRun?.run ?? "";
    expect(run).toMatch(/\blint\b/);
    expect(run).toMatch(/\btest\b/);
    expect(run).toMatch(/\bbuild\b/);
  });
});

describe("ジョブ名 (受け入れ条件 #7)", () => {
  it("外部スキャンと区別できるプロジェクト由来のジョブが定義されている", () => {
    const wf = loadWorkflow();
    const jobIds = Object.keys(wf.jobs ?? {});
    expect(jobIds.length).toBeGreaterThan(0);
    // GitGuardian 等の外部チェック名と紛れない、CI ジョブ名であること
    expect(jobIds).not.toContain("GitGuardian Security Checks");
  });
});

describe("キャッシュ設定 (受け入れ条件 #8)", () => {
  it("依存キャッシュ（setup-node の cache: pnpm もしくは actions/cache）が設定されている", () => {
    const steps = allSteps(loadWorkflow());
    const setupNodeCache = steps.some(
      (s) => (s.uses ?? "").startsWith("actions/setup-node") && s.with?.["cache"] === "pnpm",
    );
    const actionsCache = steps.some((s) => (s.uses ?? "").startsWith("actions/cache"));
    expect(setupNodeCache || actionsCache).toBe(true);
  });
});
