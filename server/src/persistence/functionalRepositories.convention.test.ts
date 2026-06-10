import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * #288: 永続化アダプタ/スケジューラはクラス（implements）ではなく
 * ポート型を返すファクトリ関数（クロージャ）で実装する規約を機械的に守る。
 * ADR-0024（functional-repositories）の決定 (a) を強制する。
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

/** server/src 配下の全 .ts を再帰収集する。 */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const tsFiles = collectTsFiles(srcRoot);
const selfPath = fileURLToPath(import.meta.url);

describe("#288 関数ファクトリ規約", () => {
  it("src 配下に Repository ポートを implements するクラスが存在しない", () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      // 例: class InMemoryXxxRepository implements XxxRepository
      if (/class\s+\w+\s+implements\s+\w*Repository\b/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src 配下に SchedulerPort を implements するクラスが存在しない", () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      if (/class\s+\w+\s+implements\s+SchedulerPort\b/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src 配下に new (InMemory|Prisma)XxxRepository( の生成が存在しない", () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      if (/new\s+(InMemory|Prisma)\w*Repository\s*\(/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src 配下に new SystemScheduler( の生成が存在しない", () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      if (/new\s+SystemScheduler\s*\(/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
