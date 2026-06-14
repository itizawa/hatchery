import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

// Issue #509: CI で PostgreSQL サービスを起動し統合テスト（skipIf(!DATABASE_URL)）を実行する。
// あわせて CI 限定の耐久性無効チューニングを適用し、本番設定に漏れていないことを検証する。

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsDir = path.join(repoRoot, ".github", "workflows");
const ciPath = path.join(workflowsDir, "ci.yml");

/** GitHub Actions ワークフローの最小構造（本テストで参照する範囲のみ）。 */
interface Workflow {
  jobs?: Record<
    string,
    {
      env?: Record<string, string>;
      services?: Record<
        string,
        {
          image?: string;
          env?: Record<string, string>;
          ports?: string[];
          options?: string;
        }
      >;
      steps?: Array<{
        name?: string;
        uses?: string;
        run?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
      }>;
    }
  >;
}

function readRaw(file: string): string {
  return readFileSync(file, "utf8");
}

function loadWorkflow(file: string): Workflow {
  return yaml.load(readRaw(file)) as Workflow;
}

function ciWorkflow(): Workflow {
  return loadWorkflow(ciPath);
}

function allSteps(wf: Workflow): NonNullable<NonNullable<Workflow["jobs"]>[string]["steps"]> {
  return Object.values(wf.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

function allServices(wf: Workflow) {
  return Object.values(wf.jobs ?? {}).flatMap((job) => Object.values(job.services ?? {}));
}

function allJobEnvValues(wf: Workflow): string[] {
  return Object.values(wf.jobs ?? {}).flatMap((job) => Object.values(job.env ?? {}));
}

// 耐久性を捨てる CI 限定チューニングのキーワード（記事(3) 相当）。
const DURABILITY_OFF_SETTINGS = ["synchronous_commit=off", "fsync=off", "full_page_writes=off"];

describe("AC1: PostgreSQL を services コンテナとして起動する", () => {
  it("CI ジョブに postgres:16 の services が定義されている（本番 POSTGRES_16 と整合）", () => {
    const services = allServices(ciWorkflow());
    const pg = services.find((s) => (s.image ?? "").startsWith("postgres:"));
    expect(pg, "postgres サービスが存在する").toBeDefined();
    expect(pg?.image).toMatch(/^postgres:16/);
  });

  it("services の postgres が 5432 ポートを公開する", () => {
    const services = allServices(ciWorkflow());
    const pg = services.find((s) => (s.image ?? "").startsWith("postgres:"));
    const ports = pg?.ports ?? [];
    expect(ports.some((p) => /5432:5432/.test(String(p)))).toBe(true);
  });

  it("CI ジョブに DATABASE_URL（localhost の postgresql 接続）が注入されている", () => {
    const wf = ciWorkflow();
    const dbUrls = allJobEnvValues(wf).filter((v) => /^postgresql:\/\//.test(v));
    expect(dbUrls.length, "job env に DATABASE_URL が定義されている").toBeGreaterThan(0);
    expect(dbUrls.some((v) => /localhost|127\.0\.0\.1/.test(v))).toBe(true);
  });
});

describe("AC3: turbo の strict env mode で DATABASE_URL がテストタスクへ渡る", () => {
  // turbo 2.x は strict env mode のため、宣言されていない env var はタスクの process.env から
  // 除外される。@hatchery/server#test の env に DATABASE_URL が無いと、CI で DB を立てても
  // 統合テストが skipIf(!DATABASE_URL) で「サイレントにスキップ」され AC3 が満たされない。
  it("turbo.json の @hatchery/server#test が env に DATABASE_URL を宣言している", () => {
    const turboPath = path.join(repoRoot, "turbo.json");
    const turbo = JSON.parse(readRaw(turboPath)) as {
      tasks?: Record<string, { env?: string[]; passThroughEnv?: string[] }>;
    };
    const task = turbo.tasks?.["@hatchery/server#test"];
    expect(task, "@hatchery/server#test タスクが定義されている").toBeDefined();
    const declared = [...(task?.env ?? []), ...(task?.passThroughEnv ?? [])];
    expect(declared).toContain("DATABASE_URL");
  });
});

describe("AC2: テスト前に Prisma マイグレーションを適用する", () => {
  it("db:migrate を実行するステップが存在する", () => {
    const steps = allSteps(ciWorkflow());
    expect(steps.some((s) => /db:migrate/.test(s.run ?? ""))).toBe(true);
  });

  it("migrate ステップは turbo test より前に置かれている（スキーマ準備後にテスト）", () => {
    const steps = allSteps(ciWorkflow());
    const migrateIdx = steps.findIndex((s) => /db:migrate/.test(s.run ?? ""));
    const turboTestIdx = steps.findIndex((s) => /turbo\s+run\b/.test(s.run ?? ""));
    expect(migrateIdx).toBeGreaterThanOrEqual(0);
    expect(turboTestIdx).toBeGreaterThanOrEqual(0);
    expect(migrateIdx).toBeLessThan(turboTestIdx);
  });
});

describe("AC4: CI 限定の耐久性無効チューニングを適用する", () => {
  it("ci.yml に耐久性を捨てる設定（synchronous_commit/fsync/full_page_writes=off）が含まれる", () => {
    const raw = readRaw(ciPath);
    for (const setting of DURABILITY_OFF_SETTINGS) {
      expect(raw, `ci.yml に ${setting} が含まれる`).toContain(setting);
    }
  });

  it("CI 専用である旨がコメントで明示されている", () => {
    const raw = readRaw(ciPath);
    expect(raw).toMatch(/CI\s*(専用|限定|only)/i);
  });
});

describe("AC6: 耐久性無効チューニングが本番デプロイ workflow に漏れていない", () => {
  const prodWorkflows = ["deploy-server-dev.yml", "deploy-server-prod.yml"];

  for (const file of prodWorkflows) {
    it(`${file} に耐久性無効チューニングが含まれない`, () => {
      const raw = readRaw(path.join(workflowsDir, file));
      for (const setting of DURABILITY_OFF_SETTINGS) {
        expect(raw, `${file} に ${setting} が漏れていない`).not.toContain(setting);
      }
    });
  }
});
