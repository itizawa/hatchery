import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("in-process スケジューラが Express サーバに組み込まれていない (受け入れ条件 #5)", () => {
  it("server/src/server.ts が startMessageBatchScheduler を呼び出していない", () => {
    const content = readFileSync(
      path.join(repoRoot, "server", "src", "server.ts"),
      "utf8",
    );
    expect(
      content,
      "server.ts は startMessageBatchScheduler を import/呼び出ししない（scale-to-zero で setTimeout が破棄されるため）",
    ).not.toMatch(/startMessageBatchScheduler/);
  });

  it("server/src/app.ts が startMessageBatchScheduler を呼び出していない", () => {
    const content = readFileSync(
      path.join(repoRoot, "server", "src", "app.ts"),
      "utf8",
    );
    expect(
      content,
      "app.ts は startMessageBatchScheduler を import/呼び出ししない（scale-to-zero で setTimeout が破棄されるため）",
    ).not.toMatch(/startMessageBatchScheduler/);
  });

  it("server/src/server.ts が schedule.ts を import していない", () => {
    const content = readFileSync(
      path.join(repoRoot, "server", "src", "server.ts"),
      "utf8",
    );
    // `\?` は JS regex でリテラルの `?` のため `\.\?.` （任意の2番目のドット）と書くこと。
    // `../batch/schedule` または `./batch/schedule` 両方をカバーする。
    expect(
      content,
      "server.ts は schedule.ts を import しない",
    ).not.toMatch(/from\s+['"]\.\.\/batch\/schedule/);
  });

  it("server/src/app.ts が schedule.ts を import していない", () => {
    const content = readFileSync(
      path.join(repoRoot, "server", "src", "app.ts"),
      "utf8",
    );
    expect(
      content,
      "app.ts は schedule.ts を import しない（シンボル名が異なっても検出できるようパスで検証）",
    ).not.toMatch(/from\s+['"]\.\.\/batch\/schedule/);
  });
});
