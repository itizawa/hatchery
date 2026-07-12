import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * #1173: OpenAPI registration関数群(registry, ctx)のオブジェクト引数化（#720）。
 * 対象8ファイルが位置引数 + eslint-disable の抜け道を使わず、
 * オブジェクト引数で max-params ルールに正当に適合していることを検証する。
 */
const TARGET_FILES = [
  "server/src/openapi/registrations/registerAdmin.ts",
  "server/src/openapi/registrations/registerAuth.ts",
  "server/src/openapi/registrations/registerCommunities.ts",
  "server/src/openapi/registrations/registerFeed.ts",
  "server/src/openapi/registrations/registerPosts.ts",
  "server/src/openapi/registrations/registerRanking.ts",
  "server/src/openapi/registrations/registerSubscriptions.ts",
  "server/src/openapi/registrations/registerWorkers.ts",
];

describe("OpenAPI registration関数群のオブジェクト引数化 (#1173)", () => {
  it.each(TARGET_FILES)("%s に eslint-disable-next-line max-params が残っていない", (relPath) => {
    const content = readFileSync(path.join(repoRoot, relPath), "utf-8");
    expect(content).not.toContain("eslint-disable-next-line max-params");
  });

  describe("disable コメント無しで max-params ルールに適合する", () => {
    let results: ESLint.LintResult[];

    beforeAll(async () => {
      const eslint = new ESLint({ cwd: repoRoot });
      results = await eslint.lintFiles(TARGET_FILES.map((relPath) => path.join(repoRoot, relPath)));
    });

    it.each(TARGET_FILES)("%s", (relPath) => {
      const result = results.find((r) => r.filePath === path.join(repoRoot, relPath));
      const maxParamsErrors = result?.messages.filter((m) => m.ruleId === "max-params") ?? [];
      expect(maxParamsErrors).toEqual([]);
    });
  });
});
