# 設計書: Issue #468 — OpenAPI 生成スクリプト（generate.ts）のテスト追加

## 背景

`server/src/openapi/generate.ts` は `pnpm --filter @hatchery/server openapi` で実行され `server/openapi.json` を生成するビルド時スクリプト。
このスクリプトが壊れると client の `gen-types`（`openapi-typescript`）が連鎖的に失敗し、型生成が止まる（CLAUDE.md「OpenAPI 一方向フロー」の起点）。

現状、`generate.ts` には専用テストが無い（`registry.test.ts` はレジストリ単体の `generateOpenApiDocument()` を検証しているが、生成スクリプトの入口そのものはノーテスト）。

## 現状の課題

`generate.ts` は全処理をモジュールトップレベルで実行している:

```ts
const doc = generateOpenApiDocument();
const outPath = resolve(...);
writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
console.log(...);
```

このため **import しただけでファイル書き込みと console.log の副作用が走り**、テストから安全に呼べない（受け入れ条件 1・4 が未達）。

## 設計判断

### 1. ドキュメント構築と副作用の分離（受け入れ条件 1・4）

`generate.ts` を以下に再構成する（後方互換を保ちつつ副作用を分離）:

- `buildOpenApiDocument(): OpenAPIObject` — `generateOpenApiDocument()` を委譲で呼ぶ純粋関数。テストから副作用なしで呼べる。
- `resolveOutputPath(): string` — 出力先 `openapi.json` の絶対パスを返す純粋関数。
- `writeOpenApiJson(): string` — 構築 → `writeFileSync` を行い、書き込んだパスを返す副作用関数（`console.log` は持たない／持っても import 時には走らない）。
- **main-module ガード**: `process.argv[1]` がこのファイルのときだけ `writeOpenApiJson()` を実行し `console.log` する。これにより `import` 時には一切の副作用が発生しない（受け入れ条件 4）。

`generateOpenApiDocument()`（registry.ts）はすでに純粋関数なので、`buildOpenApiDocument` はそれを薄くラップし「生成スクリプトの入口」をテスト対象として明示する。OpenAPI 一方向フロー（common Zod → server 生成 → client 型）は変えない（受け入れ条件 5）。

### 2. テスト（`generate.test.ts`）

`buildOpenApiDocument()` を import して検証する。`writeFileSync` はモックせず呼ばない（ファイル書き込みはテスト対象外＝受け入れ条件 4）。

- `openapi` フィールドが `3.x` 系であること（受け入れ条件 2）。
- `info`（title）を持つこと（受け入れ条件 2）。
- 代表エンドポイント `/api/feed` と `/api/communities` が `paths` に含まれること（受け入れ条件 3）。
- import 時に副作用（書き込み）が発生しないことの担保として、テストは `node:fs` の `writeFileSync` を呼ばずに完結する（条件 4）。

## スコープ外

- client 側 `openapi-typescript` 生成物の検証（別 Issue）。
- registry 単体の網羅検証は `registry.test.ts` が既にカバー済みのため重複させない。

## テスト戦略

`buildOpenApiDocument()` は DB / ネットワーク非依存の純粋関数なので、Vitest で高速に単体テスト可能。`prisma generate` 依存も無い。
