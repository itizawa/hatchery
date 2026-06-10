/**
 * 画面項目（入力フィールド）一覧の生成スクリプト（Issue #201）。
 *
 * `common` の Zod 入力スキーマから抽出した FORM_SPECS を JSON として書き出す。
 * 生成物 `docs/src/generated/field-specs.gen.json` は `.gitignore` 済みで、
 * Storybook ビルド前に turbo の依存順序（gen-field-specs → storybook:build）で再生成される。
 *
 * 既存の一方向フロー（Zod → openapi.json → 型生成）と同じ「生成由来・コミットしない」方針に揃える。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FORM_SPECS } from "../src/fieldSpec/formSpecs.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../src/generated/field-specs.gen.json");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(FORM_SPECS, null, 2)}\n`, "utf-8");

console.log(`field-specs.gen.json を生成しました: ${outPath}（${FORM_SPECS.length} フォーム）`);
