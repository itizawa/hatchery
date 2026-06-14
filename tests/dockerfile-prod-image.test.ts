import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfilePath = path.join(repoRoot, "server", "Dockerfile");

function dockerfile(): string {
  return readFileSync(dockerfilePath, "utf8");
}

describe("server/Dockerfile 本番イメージのサイズ最適化 (Issue #172)", () => {
  it("本番ステージで本番依存のみに絞る（pnpm deploy --prod / prune --prod 相当）を行う (受け入れ条件 #3)", () => {
    const raw = dockerfile();
    const hasProdReduction =
      /pnpm\s+(?:--filter\s+\S+\s+)?deploy\b[^\n]*--prod/.test(raw) ||
      /pnpm\s+(?:--filter\s+\S+\s+)?prune\b[^\n]*--prod/.test(raw) ||
      /pnpm\s+install\b[^\n]*--prod/.test(raw);
    expect(hasProdReduction, "本番依存のみに絞る pnpm deploy/prune/install --prod 行が必要").toBe(
      true,
    );
  });

  it("builder の /app 全体を本番ステージへ丸ごと COPY しない（サイズ肥大化リグレッション防止） (受け入れ条件 #4)", () => {
    const raw = dockerfile();
    // `COPY --from=builder /app ./` のような /app 全体の丸ごと再利用を禁止する。
    const copyWholeApp = /COPY\s+--from=\S+\s+\/app\s+\.\/?\s*$/m.test(raw);
    expect(copyWholeApp, "builder の /app 全体を丸ごと COPY してはならない").toBe(false);
  });

  it("壊れた /app/node_modules/.prisma への COPY を含まない（#164 不変条件の維持）", () => {
    expect(dockerfile()).not.toMatch(/node_modules\/\.prisma/);
  });
});
