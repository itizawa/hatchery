import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");
const rootPkgPath = path.join(repoRoot, "package.json");

function dockerfileLines(): string[] {
  return readFileSync(dockerfilePath, "utf8").split("\n");
}

describe("server/Dockerfile の end-to-end ビルド整合 (Issue #164)", () => {
  it("builder が tsc -b の前に tsconfig.base.json を COPY する (受け入れ条件 #1)", () => {
    const lines = dockerfileLines();
    const tsconfigCopyIdx = lines.findIndex((l) => /^\s*COPY\s+.*tsconfig\.base\.json/.test(l));
    const buildIdx = lines.findIndex((l) => /tsc -b|pnpm --filter @hatchery\/server build/.test(l));
    expect(tsconfigCopyIdx, "tsconfig.base.json を COPY する行が存在する").toBeGreaterThanOrEqual(0);
    expect(buildIdx, "ビルド（tsc -b）行が存在する").toBeGreaterThanOrEqual(0);
    expect(
      tsconfigCopyIdx,
      "tsconfig.base.json の COPY はビルドより前にある",
    ).toBeLessThan(buildIdx);
  });

  it("壊れた /app/node_modules/.prisma への COPY を含まない (受け入れ条件 #2)", () => {
    const raw = readFileSync(dockerfilePath, "utf8");
    expect(raw).not.toMatch(/node_modules\/\.prisma/);
  });

  it("onlyBuiltDependencies に bcrypt と @prisma/engines が含まれる (受け入れ条件 #3)", () => {
    const pkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
      pnpm?: { onlyBuiltDependencies?: string[] };
    };
    const allow = pkg.pnpm?.onlyBuiltDependencies ?? [];
    expect(allow, "onlyBuiltDependencies に bcrypt").toContain("bcrypt");
    expect(allow, "onlyBuiltDependencies に @prisma/engines").toContain("@prisma/engines");
  });
});
