import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(repoRoot, "docs", "adr", "README.md");

function readmeContent(): string {
  return readFileSync(readmePath, "utf8");
}

function statusSection(content: string): string {
  const start = content.indexOf("## ステータス");
  if (start === -1) throw new Error("'## ステータス' section not found in docs/adr/README.md");
  const end = content.indexOf("## ", start + 1);
  return content.slice(start, end === -1 ? undefined : end);
}

describe("docs/adr/README.md ステータス凡例 (Issue #791)", () => {
  it("凡例に Proposed 行が存在する", () => {
    const section = statusSection(readmeContent());
    expect(section).toMatch(/`Proposed`/);
  });

  it("凡例に Accepted の重複がない（1 行のみ）", () => {
    const section = statusSection(readmeContent());
    const acceptedLines = section
      .split("\n")
      .filter((line) => line.includes("`Accepted`"));
    expect(acceptedLines, "Accepted を含む凡例行が 1 行以外存在する").toHaveLength(1);
  });

  it("凡例に Superseded の説明がある", () => {
    const section = statusSection(readmeContent());
    expect(section).toMatch(/Superseded/);
  });

  it("凡例に Deprecated の説明がある", () => {
    const section = statusSection(readmeContent());
    expect(section).toMatch(/Deprecated/);
  });
});
