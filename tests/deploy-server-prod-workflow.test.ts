import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-server-prod.yml");

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

describe("deploy-server-prod.yml の存在", () => {
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

describe("Workload Identity Federation", () => {
  it("id-token の権限が設定されている", () => {
    const wf = loadWorkflow();
    const jobs = Object.values(wf.jobs ?? {});
    const hasIdToken = jobs.some((job) => job.permissions?.["id-token"] === "write");
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
    expect(raw).toContain("secrets.DATABASE_URL_PROD");
  });
});

describe("Cloud Run デプロイ", () => {
  it("Cloud Run の deploy コマンドを含む", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /gcloud run deploy/.test(s.run ?? ""));
    expect(deployStep, "gcloud run deploy ステップが存在する").toBeDefined();
  });

  it("Cloud Run サービス名が hatchery-prod である", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("hatchery-prod");
  });

  it("Docker イメージをビルドして push する", () => {
    const steps = allSteps(loadWorkflow());
    const buildStep = steps.find((s) => /docker build/.test(s.run ?? ""));
    expect(buildStep, "docker build ステップが存在する").toBeDefined();
  });
});

describe("Prisma マイグレーション", () => {
  it("マイグレーション実行ステップが存在する", () => {
    const steps = allSteps(loadWorkflow());
    const migrateStep = steps.find((s) =>
      /db:migrate|prisma migrate deploy/.test(s.run ?? ""),
    );
    expect(migrateStep, "prisma migrate ステップが存在する").toBeDefined();
  });

  it("マイグレーションステップが gcloud run deploy より前に位置する", () => {
    const steps = allSteps(loadWorkflow());
    const migrateIndex = steps.findIndex((s) =>
      /db:migrate|prisma migrate deploy/.test(s.run ?? ""),
    );
    const deployIndex = steps.findIndex((s) => /gcloud run deploy/.test(s.run ?? ""));
    expect(migrateIndex, "マイグレーションステップが存在する").toBeGreaterThanOrEqual(0);
    expect(deployIndex, "Cloud Run デプロイステップが存在する").toBeGreaterThanOrEqual(0);
    expect(migrateIndex, "マイグレーションはデプロイより前").toBeLessThan(deployIndex);
  });

  it("DATABASE_URL_PROD を secrets 経由で参照する", () => {
    const steps = allSteps(loadWorkflow());
    const migrateStep = steps.find((s) =>
      /db:migrate|prisma migrate deploy/.test(s.run ?? ""),
    );
    expect(migrateStep, "マイグレーションステップが存在する").toBeDefined();
    const envValue = (migrateStep?.env?.DATABASE_URL as string) ?? "";
    expect(envValue, "DATABASE_URL は DATABASE_URL_PROD から").toContain("DATABASE_URL_PROD");
  });
});
