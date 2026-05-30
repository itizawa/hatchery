import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ワークスペース境界を強制するルール。どちらかが発火すれば「境界違反を検出した」とみなす。 */
const BOUNDARY_RULE_IDS = new Set(["import/no-restricted-paths", "no-restricted-imports"]);

/** リポジトリ本体の eslint.config をそのまま使い、フィクスチャ文字列を擬似パスに対して評価する。 */
async function boundaryErrors(relPath: string, code: string): Promise<boolean> {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relPath),
  });
  return result.messages.some((m) => m.ruleId !== null && BOUNDARY_RULE_IDS.has(m.ruleId));
}

describe("依存方向の機械的強制 (受け入れ条件 #7) — 負ケース: 境界違反を検出する", () => {
  it("server → client は禁止", async () => {
    expect(
      await boundaryErrors(
        "server/src/bad.ts",
        `import { total } from "@hatchery/client";\nexport const x = total;\n`,
      ),
    ).toBe(true);
  });

  it("client → server は禁止", async () => {
    expect(
      await boundaryErrors(
        "client/src/bad.ts",
        `import { sum } from "@hatchery/server";\nexport const x = sum;\n`,
      ),
    ).toBe(true);
  });

  it("client → server（相対パス）も no-restricted-paths で禁止", async () => {
    expect(
      await boundaryErrors(
        "client/src/bad-relative.ts",
        `import { sum } from "../../server/src/index.js";\nexport const x = sum;\n`,
      ),
    ).toBe(true);
  });

  it("common → @hatchery/client は禁止（common はアプリ固有に依存しない）", async () => {
    expect(
      await boundaryErrors(
        "common/src/bad.ts",
        `import { total } from "@hatchery/client";\nexport const x = total;\n`,
      ),
    ).toBe(true);
  });

  it("common → @hatchery/server は禁止", async () => {
    expect(
      await boundaryErrors(
        "common/src/bad2.ts",
        `import { sum } from "@hatchery/server";\nexport const x = sum;\n`,
      ),
    ).toBe(true);
  });

  it("common → @hatchery/docs は禁止", async () => {
    expect(
      await boundaryErrors(
        "common/src/bad3.ts",
        `import { docsTotal } from "@hatchery/docs";\nexport const x = docsTotal;\n`,
      ),
    ).toBe(true);
  });

  it("docs → server は禁止（docs は client/common のみ参照可）", async () => {
    expect(
      await boundaryErrors(
        "docs/src/bad.ts",
        `import { sum } from "@hatchery/server";\nexport const x = sum;\n`,
      ),
    ).toBe(true);
  });
});

describe("依存方向の機械的強制 (受け入れ条件 #7) — 正ケース: 許可方向は通る", () => {
  it("client → common は許可", async () => {
    expect(
      await boundaryErrors(
        "client/src/ok.ts",
        `import { add } from "@hatchery/common";\nexport const x = add(1, 2);\n`,
      ),
    ).toBe(false);
  });

  it("server → common は許可", async () => {
    expect(
      await boundaryErrors(
        "server/src/ok.ts",
        `import { add } from "@hatchery/common";\nexport const x = add(1, 2);\n`,
      ),
    ).toBe(false);
  });

  it("docs → client は許可", async () => {
    expect(
      await boundaryErrors(
        "docs/src/ok.ts",
        `import { total } from "@hatchery/client";\nexport const x = total(1, 2);\n`,
      ),
    ).toBe(false);
  });

  it("docs → common は許可", async () => {
    expect(
      await boundaryErrors(
        "docs/src/ok2.ts",
        `import { add } from "@hatchery/common";\nexport const x = add(1, 2);\n`,
      ),
    ).toBe(false);
  });
});
