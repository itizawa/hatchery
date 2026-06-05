import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerignorePath = path.join(repoRoot, ".dockerignore");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");

/** .dockerignore のパターン行を取り出す（コメント・空行を除去）。 */
function loadPatterns(): string[] {
  return readFileSync(dockerignorePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** server/Dockerfile の `COPY <dir>/package.json ./<dir>/` から <dir>/package.json を抽出（重複除去）。 */
function copiedWorkspacePackageJsons(): string[] {
  const raw = readFileSync(dockerfilePath, "utf8");
  const found = new Set<string>();
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*COPY\s+([\w.-]+\/package\.json)\s/);
    if (m) found.add(m[1]);
  }
  return [...found];
}

/** パターン 1 セグメントがパス 1 セグメントにマッチするか（`*` は `/` を跨がない任意文字列）。 */
function segMatch(pat: string, seg: string): boolean {
  const escaped = pat
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`).test(seg);
}

/**
 * .dockerignore のパターンがパス（またはその祖先ディレクトリ）にマッチするか。
 * ルート起点アンカー。ディレクトリにマッチすれば配下も対象（先頭セグメント前方一致）。
 */
function patternMatches(pattern: string, filePath: string): boolean {
  const pSegs = pattern.split("/").filter(Boolean);
  const fSegs = filePath.split("/").filter(Boolean);
  if (pSegs.length > fSegs.length) return false;
  return pSegs.every((p, i) => segMatch(p, fSegs[i]));
}

/** docker のルール（後勝ち・`!` で再include・無マッチは include）で path が最終的にコンテキストへ含まれるか。 */
function isIncluded(filePath: string, patterns: string[]): boolean {
  let ignored = false;
  for (const raw of patterns) {
    const neg = raw.startsWith("!");
    const pat = neg ? raw.slice(1) : raw;
    if (patternMatches(pat, filePath)) ignored = !neg;
  }
  return !ignored;
}

describe(".dockerignore とワークスペース package.json の整合 (Issue #144)", () => {
  it("server/Dockerfile が COPY する全ワークスペースの package.json がコンテキストに含まれる (受け入れ条件 #3)", () => {
    const patterns = loadPatterns();
    const targets = copiedWorkspacePackageJsons();
    expect(targets.length, "Dockerfile から COPY 対象 package.json を抽出できる").toBeGreaterThan(0);
    for (const target of targets) {
      expect(isIncluded(target, patterns), `${target} がビルドコンテキストに含まれる`).toBe(true);
    }
  });

  it("client/package.json と docs/package.json が明示的に再include される (受け入れ条件 #1)", () => {
    const patterns = loadPatterns();
    expect(patterns).toContain("!client/package.json");
    expect(patterns).toContain("!docs/package.json");
  });

  it("client/docs 配下の package.json 以外は除外されたまま (受け入れ条件 #2)", () => {
    const patterns = loadPatterns();
    expect(isIncluded("client/src/index.tsx", patterns), "client のソースは除外").toBe(false);
    expect(isIncluded("docs/src/Welcome.mdx", patterns), "docs の中身は除外").toBe(false);
  });
});
