# 設計書: client↔server 型共有パイプライン（zod-to-openapi → openapi-typescript → openapi-fetch）(#8)

## 1. 目的 / 背景

ADR-0006 に従い、OpenAPI を HTTP 境界の単一情報源とする一方向フローを実装する。
`common` の Zod スキーマ → server で `openapi.json` 生成 → client で TypeScript 型生成 → `openapi-fetch` + TanStack Query で型安全 API 呼び出し。

## 2. スコープ（やること / やらないこと）

### やること
- server に `@asteasolutions/zod-to-openapi` を導入し、`openapi.json` を生成するスクリプト（`server:openapi`）を用意
- client に `openapi-typescript`（dev dep）+ `openapi-fetch` を導入し、型生成タスク（`client:gen-types`）を用意
- `/scenes` エンドポイントを対象に end-to-end 型安全な API クライアントの土台を実装
- Turborepo の依存チェーン（`server#openapi` → `client:gen-types` → `client:build`）を設定
- CI での型生成・差分チェック方針を本設計書に記述

### やらないこと
- MVP 全エンドポイントの網羅
- 認証付きエンドポイント

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] server で `openapi.json` を生成する `src/openapi/registry.ts` が存在し、`/scenes` の GET/POST が含まれる
- [ ] `server/package.json` に `openapi` スクリプト（tsx 実行）が定義されており、実行すると `openapi.json` が出力される
- [ ] 生成される `openapi.json` は `**/openapi.json`（`.gitignore` 済み）に出力され、コミットされない
- [ ] `client/package.json` に `gen-types` スクリプト（`openapi-typescript`）が定義されている
- [ ] `turbo.json` に `openapi` / `gen-types` タスクが追加され、`server#openapi` → `client:gen-types` → `client:build` の順が保証される
- [ ] client の `src/api/` に `openapi-fetch` ベースの API クライアントが存在し、`/scenes` GET を型安全に呼べる
- [ ] サーバー側 OpenAPI レジストリのユニットテストが存在し（`registry.test.ts`）、生成ドキュメントに `/scenes` パスと `SceneSchema` コンポーネントが含まれることを検証する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### server 側

`@asteasolutions/zod-to-openapi` の `OpenAPIRegistry` を使って Zod スキーマとルートを登録し、`OpenApiGeneratorV31` で OpenAPI 3.1.0 ドキュメントを生成する。

```
server/src/openapi/
  registry.ts    - OpenAPIRegistry の作成・スキーマ登録・パス定義
  generate.ts    - registry から openapi.json を生成して書き出すスクリプト
```

`extendZodWithOpenApi(z)` の副作用呼び出しは `registry.ts` の先頭で行う（common の Zod スキーマが `.openapi()` を持っていなくても、registry 側で `.openapi()` を付与して登録する）。

`openapi.json` の出力先: `server/openapi.json`（`**/openapi.json` で gitignore 済み）

### client 側

`openapi-typescript` で `server/openapi.json` から `src/api/openapi.gen.ts`（gitignore: `*.gen.ts`）を生成。
`openapi-fetch` の `createClient<paths>()` で型安全クライアントを作成し、TanStack Query のカスタムフック（`useScenes`）で利用する土台を実装する。

```
client/src/api/
  client.ts      - openApiClient（openapi-fetch）を export
  scenes.ts      - useScenes フック（TanStack Query + openApiClient）
```

### Turborepo

```json
"openapi": {
  "outputs": ["openapi.json"]
},
"gen-types": {
  "dependsOn": ["server#openapi"],
  "outputs": ["src/api/openapi.gen.ts"]
}
```

`client:build` の `dependsOn` に `gen-types` を追加。

## 5. 影響範囲 / 既存への変更

- **server**: `package.json`（依存追加・スクリプト追加）、`src/openapi/` 新規
- **client**: `package.json`（依存追加・スクリプト追加）、`src/api/` 新規
- **turbo.json**: タスク定義追加
- **common**: 変更なし（Zod スキーマはそのまま利用）

## 6. テスト計画

TDD で以下を書く（先にテストを書いてから実装）:

1. `server/src/openapi/registry.test.ts`
   - `generateOpenApiDocument()` が OpenAPI 3.1 ドキュメントを返す
   - 返ったドキュメントの `paths` に `/scenes` が含まれる
   - 返ったドキュメントの `components.schemas` に `Scene` が含まれる

（client 側の型安全性は TypeScript コンパイルチェックで担保する。openapi-fetch の型は `gen-types` 実行後にコンパイルエラーで検証。）

## 7. CI での型生成・差分チェック方針

- **ローカル開発**: `turbo run gen-types`（または `pnpm -F client gen-types`）で手動再生成。
- **CI**: `turbo run build` の依存チェーン（`server#openapi` → `client:gen-types` → `client:build`）によって自動再生成される。生成物（`openapi.json`・`openapi.gen.ts`）はコミットしないため、毎回ビルド時に生成されることを前提とする。
- **差分チェック**: 将来的に `git diff --exit-code` を CI に追加することで「コミット済みの openapi.json が手動で変更されていないか」を検出できるが、MVP では不要（生成物をコミットしないため差分が生じない）。
- **型不整合の検出**: `client:build`（`tsc -b`）でコンパイルエラーとして検出される。

## 8. リスク・未決事項

- Issue #27 で Scene が廃止される予定。パイプライン自体（インフラ）は残るが、対象エンドポイントが変わる。パイプライン構造を汎用的にしておけば影響は最小。
- `extendZodWithOpenApi(z)` の副作用が common 側に及ばないよう、server 内でのみ呼び出す設計にする。
