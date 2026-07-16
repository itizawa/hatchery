# 設計書: OpenAPI registration関数群(registry, ctx)をオブジェクト引数化する (#1173)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数2個以上の関数をオブジェクト引数（名前付き引数）パターンに統一するよう定めており、例外は Express ミドルウェア・配列コールバック等の外部 I/F 都合のみとしている。

`server/src/openapi/registrations/` 配下の8ファイル（`registerAdmin` / `registerAuth` / `registerFeed` / `registerCommunities` / `registerRanking` / `registerSubscriptions` / `registerPosts` / `registerWorkers`）は `registerXxx(registry: OpenAPIRegistry, ctx: RegistryContext): void` という位置引数2個の関数で、いずれも `eslint-disable-next-line max-params` で規約を素通ししている。これらは Express ミドルウェアでも配列コールバックでもない純粋な業務関数であり例外に当たらない。

同ディレクトリの `registerPushSubscriptions`（`registerPushSubscriptions.ts`）は既に `({ registry, ctx }: { registry: OpenAPIRegistry; ctx: RegistryContext }): void` のオブジェクト引数形式で実装済みで、そのまま踏襲すべき参照実装として存在する。

## 2. スコープ（やること / やらないこと）

**やること**:
- 8ファイルの `registerXxx(registry, ctx)` を `registerXxx({ registry, ctx }: { registry: OpenAPIRegistry; ctx: RegistryContext })` 形式に変更する。
- 呼び出し元 `server/src/openapi/registry.ts` の8箇所の呼び出しをオブジェクト引数形式に変更する。
- 8ファイルすべての `eslint-disable-next-line max-params` コメントを削除する。

**やらないこと**:
- registration 関数の中身（`registry.registerPath` / `registry.register` の呼び出し内容・登録順序）は一切変更しない。`openapi.json` の出力に差分を生じさせない。
- `RegistryContext` 型定義（`shared.ts`）自体は変更しない（既存の `registerPushSubscriptions` と同じ型をそのまま参照する）。
- `registerHealth` / `registerOgp` / `registerDashboard`（引数1個、disable コメントなし）は対象外。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 上記8ファイルすべてで、ファイル内に `eslint-disable-next-line max-params` という文字列が存在しないこと。
2. 上記8ファイルすべてで、実際のファイル内容を ESLint（リポジトリの `eslint.config.mjs`）で lint した結果、`max-params` ルールによるエラーが発生しないこと（＝ disable コメント無しで正当に通ること）。
3. `registry.ts` の呼び出し元が新シグネチャに追従し、`pnpm --filter @hatchery/server build`（typecheck）が通ること。
4. 既存の `registry.snapshot.test.ts`（`openapi.baseline.json` との完全一致）が変更なしに緑のままであること（＝ `generateOpenApiDocument()` の出力が不変）。
5. 既存の `registry.test.ts` が変更なしに緑のままであること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 参照実装 `registerPushSubscriptions.ts` と完全に同じパターンを8ファイルへ機械的に適用する:
  ```ts
  export function registerXxx({
    registry,
    ctx,
  }: {
    registry: OpenAPIRegistry;
    ctx: RegistryContext;
  }): void {
  ```
- 関数本体（`const { errorJson, ... } = ctx;` 以降）は無変更。分割代入で `registry` / `ctx` を受け取る点のみが変わる。
- `registry.ts` の呼び出し箇所（`registerAuth(registry, ctx);` 等）を `registerAuth({ registry, ctx });` 形式に変更する。呼び出し順序（component 登録順を保つため）は変更しない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

- `server/src/openapi/registrations/registerAdmin.ts`
- `server/src/openapi/registrations/registerAuth.ts`
- `server/src/openapi/registrations/registerCommunities.ts`
- `server/src/openapi/registrations/registerFeed.ts`
- `server/src/openapi/registrations/registerPosts.ts`
- `server/src/openapi/registrations/registerRanking.ts`
- `server/src/openapi/registrations/registerSubscriptions.ts`
- `server/src/openapi/registrations/registerWorkers.ts`
- `server/src/openapi/registry.ts`（呼び出し元）

client / common への影響なし。`openapi.json` の出力内容は不変（受け入れ条件4で担保）。

## 6. テスト計画（TDDで書くテスト一覧）

- 新規: `tests/openapi-registrations-max-params.test.ts`
  - 8ファイルそれぞれについて、ファイル内容に `eslint-disable-next-line max-params` を含まないことを確認する。
  - 8ファイルそれぞれについて、実ファイルを ESLint でlintし `max-params` ルールのエラーが0件であることを確認する（`dependency-direction.test.ts` と同様に `ESLint` クラスを直接使う）。
- 既存（変更しないが回帰確認として実行）: `server/src/openapi/registry.test.ts`・`server/src/openapi/registry.snapshot.test.ts`・`server/src/openapi/generate.test.ts`。

## 7. リスク・未決事項

- 本 Issue はユーザー可視の振る舞いを変更しない（内部の関数シグネチャ・引数渡し方のみの是正）ため、`e2e/` usecases の更新は不要と判断する（CLAUDE.md「e2e ユースケースの保守」の対象外）。PR本文にその旨を明記する。
- 未決事項なし。
