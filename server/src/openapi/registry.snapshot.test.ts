import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generateOpenApiDocument } from "./registry.js";

/**
 * 回帰スナップショットテスト（#535）。
 *
 * registry.ts をリソース別モジュールへ分割するリファクタの前後で、
 * `generateOpenApiDocument()` が生成する OpenAPI ドキュメントが byte 単位で
 * 不変であることを固定 fixture との完全一致で保証する。
 *
 * fixture（openapi.baseline.json）は分割前の `pnpm --filter @hatchery/server openapi`
 * 出力をそのまま固定したもの。API スキーマを意図的に変更した場合のみ fixture を更新する。
 */
describe("generateOpenApiDocument スナップショット回帰（#535）", () => {
  const baselinePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "./__fixtures__/openapi.baseline.json",
  );

  it("分割前後で openapi.json が完全一致する（差分なし）", () => {
    // 末尾改行の有無に依存しないよう trimEnd() で正規化して比較する（#925: push_files は末尾改行を付与する）。
    const expected = readFileSync(baselinePath, "utf-8").trimEnd();
    // 生成スクリプト（generate.ts）と同じ整形（2 スペースインデント）で文字列化して比較する。
    const actual = JSON.stringify(generateOpenApiDocument(), null, 2);
    expect(actual).toBe(expected);
  });
});
