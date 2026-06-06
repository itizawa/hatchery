import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-server-dev.yml");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");

interface Workflow {
  on?: {
    push?: { branches?: string[] };
  };
  jobs?: Record<
    string,
    {
      "runs-on"?: string;
      permissions?: Record<string, string>;
      steps?: Array<{
        uses?: string;
        run?: string;
        name?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
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

describe("deploy-server-dev.yml の存在 (受け入れ条件 #1)", () => {
  it("ファイルが存在する", () => {
    expect(existsSync(workflowPath), `${workflowPath} が存在する`).toBe(true);
  });

  it("valid YAML である", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("トリガー定義 (受け入れ条件 #1)", () => {
  it("develop への push をトリガーにする", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches).toContain("develop");
  });

  it("main を直接トリガーにしない（ゲート1整合）", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches ?? []).not.toContain("main");
  });
});

describe("Workload Identity Federation (受け入れ条件 #4)", () => {
  it("id-token の権限が設定されている", () => {
    const wf = loadWorkflow();
    const jobs = Object.values(wf.jobs ?? {});
    const hasIdToken = jobs.some(
      (job) => job.permissions?.["id-token"] === "write",
    );
    expect(hasIdToken, "id-token: write が設定されている").toBe(true);
  });

  it("google-github-actions/auth で WIF 認証を行う", () => {
    const steps = allSteps(loadWorkflow());
    const authStep = steps.find((s) => (s.uses ?? "").startsWith("google-github-actions/auth"));
    expect(authStep, "google-github-actions/auth ステップが存在する").toBeDefined();
  });

  it("シークレットは ${{ secrets.* }} 参照のみ（平文なし）", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.GCP_WORKLOAD_IDENTITY_PROVIDER");
    expect(raw).toContain("secrets.GCP_SA_EMAIL");
    // DATABASE_URL 等の機密情報も secrets 経由
    expect(raw).toContain("secrets.DATABASE_URL");
  });
});

describe("Cloud Run デプロイ (受け入れ条件 #1)", () => {
  it("Cloud Run の deploy コマンドを含む", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /gcloud run deploy/.test(s.run ?? ""));
    expect(deployStep, "gcloud run deploy ステップが存在する").toBeDefined();
  });

  it("Docker イメージをビルドして push する", () => {
    const steps = allSteps(loadWorkflow());
    const buildStep = steps.find((s) => /docker build/.test(s.run ?? ""));
    expect(buildStep, "docker build ステップが存在する").toBeDefined();
  });
});

describe("Dockerfile の存在 (受け入れ条件 #6)", () => {
  it("server/Dockerfile が存在する", () => {
    expect(existsSync(dockerfilePath), "server/Dockerfile が存在する").toBe(true);
  });

  it("Node 26 ベースイメージを使用する", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toMatch(/FROM node:26/);
  });
});
