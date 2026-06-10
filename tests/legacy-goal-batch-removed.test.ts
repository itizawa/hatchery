/**
 * Issue #335: 旧 goal 系バッチ（planningBatch / researcherBatch / githubIssueTool ほか）の削除を保証する規約テスト。
 *
 * ADR-0023 §(a) により channel 時代の goal 系バッチコードは廃止された。
 * 本テストは server/src/batch/ に旧 goal 系バッチのファイル・識別子が残っていないことを保証する。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pathExists(rel: string): boolean {
  return existsSync(path.join(repoRoot, rel));
}

function readFile(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

/** 旧 goal 系バッチの削除対象ファイル（Issue #335 / #330 の削除対象表）。 */
const REMOVED_BATCH_FILES = [
  "server/src/batch/planningBatch.ts",
  "server/src/batch/planningBatch.test.ts",
  "server/src/batch/planningBatch.goal.test.ts",
  "server/src/batch/planningBatch.tokenUsage.test.ts",
  "server/src/batch/researcherBatch.ts",
  "server/src/batch/researcherBatch.test.ts",
  "server/src/batch/researcherIndex.ts",
  "server/src/batch/githubIssueTool.ts",
  "server/src/batch/githubIssueTool.test.ts",
  "server/src/batch/rosterMessageGenerator.ts",
  "server/src/batch/rosterMessageGenerator.test.ts",
  "server/src/batch/rosterMessageGenerator.membership.test.ts",
  "server/src/batch/runAiMessageBatch.goal.test.ts",
] as const;

/** server/src/ に残ってはならない旧 goal 系バッチの識別子（受け入れ条件 #2 の grep パターン）。 */
const FORBIDDEN_IDENTIFIERS = [
  "planningBatch",
  "researcherBatch",
  "githubIssueTool",
  "rosterMessageGenerator",
] as const;

describe("Issue #335: 旧 goal 系バッチファイルが削除されている (受け入れ条件 #1)", () => {
  for (const rel of REMOVED_BATCH_FILES) {
    it(`${rel} が存在しない`, () => {
      expect(pathExists(rel)).toBe(false);
    });
  }
});

describe("Issue #335: server/src に旧 goal 系バッチの識別子が残っていない (受け入れ条件 #2)", () => {
  it("planningBatch / researcherBatch / githubIssueTool / rosterMessageGenerator がヒットしない", () => {
    const tsFiles = getAllTsFiles(path.join(repoRoot, "server/src"));
    const violations: string[] = [];
    for (const file of tsFiles) {
      const code = readFileSync(file, "utf8");
      for (const ident of FORBIDDEN_IDENTIFIERS) {
        if (code.includes(ident)) {
          violations.push(`${path.relative(repoRoot, file)}: ${ident}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("Issue #335: server/package.json から goal 系の痕跡が消えている (受け入れ条件 #3)", () => {
  it("batch:researcher script が存在しない", () => {
    const pkg = readFile("server/package.json");
    expect(pkg).not.toMatch(/"batch:researcher"/);
  });

  it("@octokit/rest 依存が存在しない（goal 系バッチ専用依存の除去）", () => {
    const pkg = readFile("server/package.json");
    expect(pkg).not.toMatch(/@octokit\/rest/);
  });
});

describe("Issue #335: Community ベースの新実装は維持されている", () => {
  it("server/src/batch/communityBatchIndex.ts が存在する", () => {
    expect(pathExists("server/src/batch/communityBatchIndex.ts")).toBe(true);
  });

  it("server/src/batch/runCommunityBatch.ts が存在する", () => {
    expect(pathExists("server/src/batch/runCommunityBatch.ts")).toBe(true);
  });
});
