import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ciPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

/** turbo Remote Cache の検証で参照するワークフロー最小構造。 */
interface Workflow {
  jobs?: Record<
    string,
    {
      env?: Record<string, string>;
      steps?: Array<{
        run?: string;
        env?: Record<string, string>;
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

/** turbo run を実行するステップを持つジョブと、その有効な env（job + step）を返す。 */
function turboRunEnvs(): Array<Record<string, string>> {
  const wf = loadWorkflow();
  const results: Array<Record<string, string>> = [];
  for (const job of Object.values(wf.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (/turbo\s+run\b/.test(step.run ?? "")) {
        results.push({ ...(job.env ?? {}), ...(step.env ?? {}) });
      }
    }
  }
  return results;
}

describe("CI Turborepo Remote Caching (Issue #508)", () => {
  it("turbo run を実行するステップが存在する", () => {
    expect(turboRunEnvs().length).toBeGreaterThan(0);
  });

  it("turbo run の有効 env に TURBO_TOKEN が GitHub Secrets 経由で渡される", () => {
    for (const env of turboRunEnvs()) {
      expect(env.TURBO_TOKEN, "TURBO_TOKEN が turbo run に渡る").toBeDefined();
      // 平文ではなく secrets コンテキスト参照であること（受け入れ条件 #2）。
      expect(env.TURBO_TOKEN).toMatch(/\$\{\{\s*secrets\.TURBO_TOKEN\s*\}\}/);
    }
  });

  it("turbo run の有効 env に TURBO_TEAM が GitHub コンテキスト経由で渡される", () => {
    for (const env of turboRunEnvs()) {
      expect(env.TURBO_TEAM, "TURBO_TEAM が turbo run に渡る").toBeDefined();
      // secrets もしくは vars コンテキスト参照であること（平文 slug をハードコードしない）。
      expect(env.TURBO_TEAM).toMatch(/\$\{\{\s*(secrets|vars)\.TURBO_TEAM\s*\}\}/);
    }
  });

  it("ci.yml に TURBO_TOKEN の値が平文で埋め込まれていない", () => {
    const raw = readRaw();
    // TURBO_TOKEN: の右辺は必ず secrets 参照。生のトークン文字列を許さない。
    const matches = raw.match(/TURBO_TOKEN:\s*(.+)/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const line of matches) {
      expect(line).toMatch(/\$\{\{\s*secrets\.TURBO_TOKEN\s*\}\}/);
    }
  });
});
