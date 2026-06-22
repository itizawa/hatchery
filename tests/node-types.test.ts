import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("@types/node バージョンの整合性 (#793)", () => {
  it("ルート package.json の @types/node が Node 26 系（^26）を指定している", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    const typesNodeVersion = pkg.devDependencies?.["@types/node"] ?? "";
    expect(typesNodeVersion).toMatch(/^\^?26/);
  });
});
