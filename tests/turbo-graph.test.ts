import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface DryTask {
  taskId: string;
  task: string;
  package: string;
  dependencies: string[];
}

/**
 * turbo の構造化出力（--dry=json）からタスクグラフを取得する。
 * turbo はネイティブバイナリのため Node 版に依存しない。
 */
function readTaskGraph(): DryTask[] {
  const turboBin = path.join(repoRoot, "node_modules", ".bin", "turbo");
  const out = execFileSync(turboBin, ["run", "build", "--dry=json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const parsed = JSON.parse(out) as { tasks: DryTask[] };
  return parsed.tasks;
}

describe("Turborepo タスク依存順 (受け入れ条件 #4)", () => {
  it("common の build が client / server / docs の build の依存に入る", () => {
    const tasks = readTaskGraph();
    const byId = new Map(tasks.map((t) => [t.taskId, t]));

    for (const consumer of [
      "@hatchery/client#build",
      "@hatchery/server#build",
      "@hatchery/docs#build",
    ]) {
      const task = byId.get(consumer);
      expect(task, `${consumer} がタスクグラフに存在する`).toBeDefined();
      expect(task?.dependencies, `${consumer} は @hatchery/common#build に依存する`).toContain(
        "@hatchery/common#build",
      );
    }
  });
});
