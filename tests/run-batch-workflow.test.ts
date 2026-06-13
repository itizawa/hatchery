import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "run-batch.yml");

interface WorkflowOn {
  schedule?: Array<{ cron: string }>;
  workflow_dispatch?: Record<string, unknown>;
}

interface WorkflowStep {
  uses?: string;
  run?: string;
  name?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  "runs-on"?: string;
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
}

interface Workflow {
  on?: WorkflowOn;
  jobs?: Record<string, WorkflowJob>;
}

function loadWorkflow(): Workflow {
  const raw = readFileSync(workflowPath, "utf8");
  return yaml.load(raw) as Workflow;
}

function allSteps(wf: Workflow): WorkflowStep[] {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe("run-batch.yml の存在と構造 (受け入れ条件 #1)", () => {
  it("ファイルが存在する", () => {
    expect(existsSync(workflowPath), `${workflowPath} が存在する`).toBe(true);
  });

  it("valid YAML である", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("schedule トリガー (受け入れ条件 #2)", () => {
  it("schedule トリガーが設定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.schedule, "schedule トリガーが存在する").toBeDefined();
    expect(wf.on?.schedule?.length, "schedule エントリが 1 件以上").toBeGreaterThanOrEqual(1);
  });

  it("JST [9,12,15,18] → UTC [0,3,6,9] の cron を含む", () => {
    const wf = loadWorkflow();
    const crons = (wf.on?.schedule ?? []).map((s) => s.cron);
    // 全スケジュールを結合してチェック（1 本でも 4 本でも対応）
    const combined = crons.join(" ");
    // UTC 0,3,6,9 時のいずれかを含む
    const utcHours = [0, 3, 6, 9];
    for (const h of utcHours) {
      // includes チェックで全ポジション（先頭/中間/末尾）をカバーする。
      // 正規表現は使わない: `[0-9,]*9[0-9,]*` のような桁包含パターンは
      // 19 や 29 など意図しない時刻にもマッチするため false positive を生む。
      const hasHour =
        combined.includes(`0 ${h} `) || // 単独（例: "0 9 * * *"）
        combined.includes(`0 ${h},`) || // 先頭（例: "0 9,12,..."）
        combined.includes(`,${h} `) || // 末尾（例: "...,9 * * *"）
        combined.includes(`,${h},`); // 中間（例: "...,9,..."）
      expect(hasHour, `UTC ${h}:00 (JST ${h + 9}:00) の cron を含む`).toBe(true);
    }
  });

  it("workflow_dispatch（手動トリガー）も設定されている", () => {
    const wf = loadWorkflow();
    expect(wf.on?.workflow_dispatch, "workflow_dispatch トリガーが存在する").toBeDefined();
  });
});

describe("バッチ実行ステップ (受け入れ条件 #3)", () => {
  it("pnpm --filter @hatchery/server batch を実行するステップが存在する", () => {
    const steps = allSteps(loadWorkflow());
    const batchStep = steps.find((s) =>
      /pnpm.*--filter.*@hatchery\/server.*batch/.test(s.run ?? ""),
    );
    expect(batchStep, "バッチ実行ステップが存在する").toBeDefined();
  });
});

describe("依存ビルドステップ (受け入れ条件 #5: common ビルド + Prisma generate)", () => {
  it("@hatchery/common をビルドするステップが存在する", () => {
    const steps = allSteps(loadWorkflow());
    // pnpm turbo run build --filter=@hatchery/server で common も Turboの依存グラフ経由でビルドされる
    const buildStep = steps.find(
      (s) =>
        /turbo\s+run\s+build/.test(s.run ?? "") &&
        /--filter[= ]+@hatchery\/server/.test(s.run ?? ""),
    );
    expect(buildStep, "@hatchery/server（と依存 common）をビルドするステップが存在する").toBeDefined();
  });

  it("ビルドステップはバッチ実行ステップより前にある", () => {
    const steps = allSteps(loadWorkflow());
    const buildIdx = steps.findIndex(
      (s) =>
        /turbo\s+run\s+build/.test(s.run ?? "") &&
        /--filter[= ]+@hatchery\/server/.test(s.run ?? ""),
    );
    const batchIdx = steps.findIndex((s) =>
      /pnpm.*--filter.*@hatchery\/server.*batch/.test(s.run ?? ""),
    );
    expect(buildIdx, "ビルドステップが存在する").toBeGreaterThanOrEqual(0);
    expect(batchIdx, "バッチ実行ステップが存在する").toBeGreaterThanOrEqual(0);
    expect(buildIdx, "ビルドは batch より前").toBeLessThan(batchIdx);
  });
});

describe("secrets 経由の環境変数 (受け入れ条件 #4)", () => {
  it("ANTHROPIC_API_KEY が secrets 経由で渡される", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.ANTHROPIC_API_KEY");
  });

  it("DATABASE_URL が secrets 経由で渡される", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.DATABASE_URL");
  });

  it("平文の API キー / パスワードがハードコードされていない", () => {
    const raw = readFileSync(workflowPath, "utf8");
    // "sk-ant-" 等のプレフィックスや "anthropic_api_key = " のような直書きがないことを確認
    expect(raw).not.toMatch(/sk-ant-[a-zA-Z0-9\-_]+/);
    expect(raw).not.toMatch(/ANTHROPIC_API_KEY\s*=\s*['"a-zA-Z0-9]/);
  });
});
