import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ciPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

interface Workflow {
  jobs?: Record<
    string,
    {
      steps?: Array<{ uses?: string; run?: string; name?: string }>;
    }
  >;
}

function loadWorkflow(): Workflow {
  return yaml.load(readFileSync(ciPath, "utf8")) as Workflow;
}

function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe("CI に依存監査ステップ (受け入れ条件 #5)", () => {
  it("pnpm audit を実行するステップが定義されている", () => {
    const steps = allSteps(loadWorkflow());
    expect(steps.some((s) => /pnpm\s+audit\b/.test(s.run ?? ""))).toBe(true);
  });

  it("audit は --audit-level を指定している（しきい値を明示して誤検知を抑制）", () => {
    const steps = allSteps(loadWorkflow());
    const auditStep = steps.find((s) => /pnpm\s+audit\b/.test(s.run ?? ""));
    expect(auditStep, "pnpm audit ステップが存在する").toBeDefined();
    expect(auditStep?.run).toMatch(/--audit-level/);
  });

  it("audit は --prod を指定している（devDeps のトランジティブ脆弱性で本番 CI をブロックしない）", () => {
    const steps = allSteps(loadWorkflow());
    const auditStep = steps.find((s) => /pnpm\s+audit\b/.test(s.run ?? ""));
    expect(auditStep, "pnpm audit ステップが存在する").toBeDefined();
    expect(auditStep?.run).toMatch(/--prod/);
  });
});
