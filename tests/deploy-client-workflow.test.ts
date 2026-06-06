import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "deploy-client-dev.yml");
const wranglerTomlPath = path.join(repoRoot, "client", "wrangler.toml");
const clientPkgPath = path.join(repoRoot, "client", "package.json");
const setupDocPath = path.join(repoRoot, "docs", "deploy", "setup.md");

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

describe("deploy-client-dev.yml の存在 (受け入れ条件 #2)", () => {
  it("ファイルが存在する", () => {
    expect(existsSync(workflowPath), `${workflowPath} が存在する`).toBe(true);
  });

  it("valid YAML である", () => {
    const wf = loadWorkflow();
    expect(wf).toBeTypeOf("object");
    expect(wf).not.toBeNull();
  });
});

describe("トリガー定義 (受け入れ条件 #2)", () => {
  it("develop への push をトリガーにする", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches).toContain("develop");
  });

  it("main を直接トリガーにしない（ゲート1整合）", () => {
    const wf = loadWorkflow();
    expect(wf.on?.push?.branches ?? []).not.toContain("main");
  });
});

describe("VITE_API_BASE_URL の設定 (受け入れ条件 #3)", () => {
  it("ワークフローに VITE_API_BASE_URL が含まれる", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("VITE_API_BASE_URL");
  });
});

describe("シークレット管理 (受け入れ条件 #4)", () => {
  it("Cloudflare API token を secrets 経由で参照する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.CLOUDFLARE_API_TOKEN");
  });

  it("Cloudflare account ID を secrets 経由で参照する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
  });
});

describe("Cloudflare Pages デプロイ (受け入れ条件 #2)", () => {
  it("cloudflare/wrangler-action または wrangler pages deploy を使用する", () => {
    const raw = readFileSync(workflowPath, "utf8");
    const usesWranglerAction = raw.includes("cloudflare/wrangler-action");
    const usesWranglerCLI = raw.includes("wrangler pages deploy");
    expect(
      usesWranglerAction || usesWranglerCLI,
      "wrangler-action か wrangler pages deploy を使用している",
    ).toBe(true);
  });

  it("pnpm でビルドするステップが含まれる", () => {
    const steps = allSteps(loadWorkflow());
    const buildStep = steps.find((s) => /pnpm.*turbo.*build|pnpm.*build/.test(s.run ?? ""));
    expect(buildStep, "pnpm build ステップが存在する").toBeDefined();
  });
});

describe("wrangler.toml の存在 (受け入れ条件 #2)", () => {
  it("client/wrangler.toml が存在する", () => {
    expect(existsSync(wranglerTomlPath), "client/wrangler.toml が存在する").toBe(true);
  });

  it("プロジェクト名が設定されている", () => {
    const content = readFileSync(wranglerTomlPath, "utf8");
    expect(content).toMatch(/name\s*=/);
  });
});

describe("セットアップ手順書の存在 (受け入れ条件 #5)", () => {
  it("docs/deploy/setup.md が存在する", () => {
    expect(existsSync(setupDocPath), "docs/deploy/setup.md が存在する").toBe(true);
  });

  it("GitHub Secrets の設定手順が含まれる", () => {
    const content = readFileSync(setupDocPath, "utf8");
    expect(content).toContain("GitHub Secrets");
  });

  it("GCP のセットアップ手順が含まれる", () => {
    const content = readFileSync(setupDocPath, "utf8");
    expect(content).toMatch(/Google Cloud|GCP/);
  });

  it("Cloudflare のセットアップ手順が含まれる", () => {
    const content = readFileSync(setupDocPath, "utf8");
    expect(content).toContain("Cloudflare");
  });
});

describe("wrangler の解決方法 (Issue #141)", () => {
  it("client に wrangler が devDependency としてバージョン固定で含まれる (受け入れ条件 #1)", () => {
    const pkg = JSON.parse(readFileSync(clientPkgPath, "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    const version = pkg.devDependencies?.wrangler;
    expect(version, "client devDependencies に wrangler がある").toBeTypeOf("string");
    expect((version ?? "").length, "wrangler のバージョン指定が空でない").toBeGreaterThan(0);
  });

  it("cloudflare/wrangler-action を使わない（動的インストールの排除） (受け入れ条件 #2)", () => {
    const raw = readFileSync(workflowPath, "utf8");
    expect(raw).not.toContain("cloudflare/wrangler-action");
  });

  it("デプロイは pnpm exec wrangler pages deploy で実行する (受け入れ条件 #3)", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /wrangler pages deploy/.test(s.run ?? ""));
    expect(deployStep, "wrangler pages deploy を実行するステップが存在する").toBeDefined();
    expect(deployStep?.run).toMatch(/pnpm exec wrangler pages deploy/);
  });

  it("Cloudflare 認証情報を env 経由で wrangler に渡す (受け入れ条件 #4)", () => {
    const steps = allSteps(loadWorkflow());
    const deployStep = steps.find((s) => /wrangler pages deploy/.test(s.run ?? ""));
    expect(deployStep?.env?.CLOUDFLARE_API_TOKEN).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(deployStep?.env?.CLOUDFLARE_ACCOUNT_ID).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
  });
});
