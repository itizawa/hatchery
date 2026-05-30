import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** pnpm-workspace.yaml の packages 行を素朴にパースする（依存ゼロで頑健に保つ）。 */
function readWorkspacePackages(): string[] {
  const yaml = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  return yaml
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function readPackageName(workspaceDir: string): string {
  const pkg = JSON.parse(
    readFileSync(path.join(repoRoot, workspaceDir, "package.json"), "utf8"),
  ) as { name?: string };
  return pkg.name ?? "";
}

describe("pnpm workspaces (受け入れ条件 #1, #2)", () => {
  it("docs / client / server / common の 4 ワークスペースを定義する", () => {
    expect(new Set(readWorkspacePackages())).toEqual(
      new Set(["common", "server", "client", "docs"]),
    );
  });

  it("各ワークスペースの name が @hatchery/* である", () => {
    expect(readPackageName("common")).toBe("@hatchery/common");
    expect(readPackageName("server")).toBe("@hatchery/server");
    expect(readPackageName("client")).toBe("@hatchery/client");
    expect(readPackageName("docs")).toBe("@hatchery/docs");
  });
});
