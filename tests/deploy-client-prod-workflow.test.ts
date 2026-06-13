import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-client-prod.yml");

interface Workflow {
  on?: {
    push?: { branches?: string[] };
  };
  jobs?: Record<
    string,
    {
      "runs-on"?: string;
      steps?: Array<{
        uses?: string;
        run?: string;
        name?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
        "working-directory"?: string;
      }>;
    }
  >;
}

function loadWorkflow(): Workflow {
  const raw = readFileSync(workflowPath, "utf8");
  return yaml.load(raw) as Workflow;
}

function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe("deploy-client-prod.yml の存在", () => {
  it("ファイルが存在する", () => {
    expect(existsSync(workflowPath), `${workflowPath} が存在する`).toBe(true);
  });

  it("valid YAML である", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("トリガー定義", () => {
  it("main への push をトリガーにする", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches).toContain("main");
  });

  it("develop を直接トリガーにしない", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches ?? []).not.toContain("develop");
  });
});

describe("VITE_API_BASE_URL の設定", () => {
  it("CLOUD_RUN_PROD_URL を VITE_API_BASE_URL に使用する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("VITE_API_BASE_URL");
    expect(raw).toContain("CLOUD_RUN_PROD_URL");
  });
});

describe("シークレット管理", () => {
  it("Cloudflare API token を secrets 経由で参照する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.CLOUDFLARE_API_TOKEN");
  });

  it("Cloudflare account ID を secrets 経由で参照する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
  });
});

describe("Cloudflare Pages デプロイ", () => {
  it("wrangler pages deploy を使用する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("wrangler pages deploy");
  });

  it("pnpm exec wrangler で実行する", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /wrangler pages deploy/.test(s.run ?? ""));
    expect(deployStep, "wrangler pages deploy ステップが存在する").toBeDefined();
    expect(deployStep?.run).toMatch(/pnpm exec wrangler pages deploy/);
  });

  it("--branch main が指定されている（本番エイリアス）", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("--branch main");
  });

  it("pnpm ビルドステップが含まれる", () => {
    const steps = allSteps(loadWorkflow());
    const buildStep = steps.find((s) => /pnpm.*turbo.*build|pnpm.*build/.test(s.run ?? ""));
    expect(buildStep, "pnpm build ステップが存在する").toBeDefined();
  });

  it("Cloudflare 認証情報を env 経由で wrangler に渡す", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /wrangler pages deploy/.test(s.run ?? ""));
    expect(deployStep?.env?.CLOUDFLARE_API_TOKEN).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(deployStep?.env?.CLOUDFLARE_ACCOUNT_ID).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
  });

  it("cloudflare/wrangler-action を使わない（動的インストールの排除）", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).not.toContain("cloudflare/wrangler-action");
  });
});
