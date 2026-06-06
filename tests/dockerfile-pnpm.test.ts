import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");
const rootPkgPath = path.join(repoRoot, "package.json");

function dockerfile(): string {
  return readFileSync(dockerfilePath, "utf8");
}

/** ルート package.json の packageManager から pnpm のバージョンを取り出す（例: "pnpm@10.34.1" → "10.34.1"）。 */
function pnpmVersionFromPackageManager(): string {
  const pkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as { packageManager?: string };
  const m = (pkg.packageManager ?? "").match(/^pnpm@(.+)$/);
  if (!m) throw new Error(`packageManager が pnpm@<version> 形式でない: ${pkg.packageManager}`);
  return m[1];
}

describe("server/Dockerfile の pnpm 取得 (Issue #162)", () => {
  it("corepack に依存しない（corepack を含む行が無い） (受け入れ条件 #1)", () => {
    const lines = dockerfile().split("\n");
    const offending = lines.filter((line) => /corepack/.test(line));
    expect(offending, `corepack を含む行が残っている: ${offending.join(" / ")}`).toHaveLength(0);
  });

  it("pnpm をバージョン固定でグローバル導入する (受け入れ条件 #2)", () => {
    // 本番ステージは builder 成果物を丸ごと再利用し pnpm を入れない場合があるため、
    // 「pnpm を実行するステージ（= builder）で 1 回以上」固定導入されていれば良い（#164）。
    const version = pnpmVersionFromPackageManager();
    const escaped = version.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`npm install -g pnpm@${escaped}(?![\\w.-])`, "g");
    const matches = dockerfile().match(re) ?? [];
    expect(
      matches.length,
      `npm install -g pnpm@${version} が 1 回以上必要（検出: ${matches.length}）`,
    ).toBeGreaterThanOrEqual(1);
  });

  it("導入する pnpm バージョンが package.json の packageManager と一致する (受け入れ条件 #2/#3)", () => {
    const version = pnpmVersionFromPackageManager();
    // Dockerfile が固定する pnpm のバージョン群を抽出し、すべて packageManager と一致すること。
    const found = [...dockerfile().matchAll(/npm install -g pnpm@([\w.-]+)/g)].map((m) => m[1]);
    expect(found.length, "npm install -g pnpm@<version> が存在する").toBeGreaterThan(0);
    for (const v of found) {
      expect(v, `pnpm のバージョンは packageManager(${version}) と一致する`).toBe(version);
    }
  });
});
