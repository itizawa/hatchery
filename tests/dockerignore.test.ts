import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerignorePath = path.join(repoRoot, ".dockerignore");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");

const dockerignoreRules = parseDockerignore(readFileSync(dockerignorePath, "utf8"));
const dockerfileContent = readFileSync(dockerfilePath, "utf8");

function parseDockerignore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function isExcludedByDockerignore(filePath: string, rules: string[]): boolean {
  let excluded = false;
  for (const rule of rules) {
    const isNegation = rule.startsWith("!");
    const pattern = isNegation ? rule.slice(1) : rule;
    if (matchesPattern(filePath, pattern)) {
      excluded = !isNegation;
    }
  }
  return excluded;
}

// 注: このマッチャーは完全一致とディレクトリプレフィックスのみ対応（glob 非対応）。
// 現行 .dockerignore の glob パターン（*.md 等）は package.json パスに当たらないため影響なし。
function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern === filePath) return true;
  if (filePath.startsWith(pattern + "/")) return true;
  return false;
}

function extractCopiedPackageJsonPaths(content: string): string[] {
  const paths = content
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^COPY\s+(\S+\/package\.json)\s+/);
      return match ? [match[1]] : [];
    });
  return [...new Set(paths)];
}

describe("受け入れ条件 #1: client/package.json と docs/package.json が再 include される", () => {
  it("client/package.json は除外されない", () => {
    expect(isExcludedByDockerignore("client/package.json", dockerignoreRules)).toBe(false);
  });

  it("docs/package.json は除外されない", () => {
    expect(isExcludedByDockerignore("docs/package.json", dockerignoreRules)).toBe(false);
  });
});

describe("受け入れ条件 #2: client/ docs/ 配下のその他ファイルは引き続き除外される", () => {
  it("client/src/main.ts は除外される", () => {
    expect(isExcludedByDockerignore("client/src/main.ts", dockerignoreRules)).toBe(true);
  });

  it("docs/adr/0001.md は除外される", () => {
    expect(isExcludedByDockerignore("docs/adr/0001.md", dockerignoreRules)).toBe(true);
  });
});

describe("受け入れ条件 #3: Dockerfile の COPY */package.json が全て除外されない（回帰防止）", () => {
  it("Dockerfile が client/package.json と docs/package.json を参照している", () => {
    const paths = extractCopiedPackageJsonPaths(dockerfileContent);
    expect(paths).toContain("client/package.json");
    expect(paths).toContain("docs/package.json");
  });

  it("Dockerfile が参照する全 package.json が .dockerignore で除外されない", () => {
    const paths = extractCopiedPackageJsonPaths(dockerfileContent);
    for (const p of paths) {
      expect(
        isExcludedByDockerignore(p, dockerignoreRules),
        `${p} は .dockerignore で除外されてはならない`,
      ).toBe(false);
    }
  });
});
