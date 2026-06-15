import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { OpenAPIObject } from "openapi3-ts/oas31";

import { generateOpenApiDocument } from "./registry.js";

/**
 * OpenAPI ドキュメントを構築して返す純粋関数（#468）。
 * registry の {@link generateOpenApiDocument} を委譲で呼ぶだけで、ファイル書き込み等の
 * 副作用を持たない。テストはこの関数を import して生成結果の妥当性を検証する。
 */
export function buildOpenApiDocument(): OpenAPIObject {
  return generateOpenApiDocument();
}

/** openapi.json の出力先絶対パスを返す純粋関数。 */
export function resolveOutputPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../openapi.json");
}

/**
 * OpenAPI ドキュメントを構築し openapi.json に書き出す副作用関数。
 * 書き込んだパスを返す。`openapi` script（main-module 実行）からのみ呼ぶ。
 */
export function writeOpenApiJson(): string {
  const doc = buildOpenApiDocument();
  const outPath = resolveOutputPath();
  writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
  return outPath;
}

// main-module ガード（#468）: このファイルがスクリプトとして直接実行されたときだけ
// ファイル書き込み + ログを行う。テスト等から import した場合は一切の副作用を起こさない。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outPath = writeOpenApiJson();
  console.log(`openapi.json を生成しました: ${outPath}`);
}
