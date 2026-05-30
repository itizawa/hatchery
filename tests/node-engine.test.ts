import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Node 版の実効化 (受け入れ条件 #8)", () => {
  it("ルート package.json の engines.node が 26 系を要求する", () => {
    const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toMatch(/26/);
  });

  it(".nvmrc が 26 系である", () => {
    expect(read(".nvmrc").trim()).toMatch(/^26/);
  });

  it(".npmrc に engine-strict=true がある（宣言を実効化する）", () => {
    const npmrc = read(".npmrc");
    expect(npmrc).toMatch(/^engine-strict\s*=\s*true\s*$/m);
  });
});
