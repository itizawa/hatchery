# 設計書: client の admin API で残った生 fetch を openApiClient に置き換える (#184)

## 1. 目的 / 背景

ADR-0006 で client ↔ server の HTTP 呼び出しは型安全な `openApiClient`（`openapi-fetch` の `createClient<paths>`）に統一する方針を定めている。`channels.ts` / `scenes.ts` / `auth.ts` は移行済みだったが、`admin.ts` と `batchLogs.ts` に生の `fetch()` が残っていた。生の相対 `fetch` はクロスオリジン配信（#78）で baseUrl が前置されず壊れるリスクもある。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/api/admin.ts` の `fetchSettings`（GET）・`patchSetting`（PATCH）を `openApiClient` 経由に置き換える
- `client/src/api/batchLogs.ts` の `fetchBatchLogs`（GET）を `openApiClient` 経由に置き換える
- 各関数の外部インターフェース（引数・戻り値型・queryKey）を維持する
- エラー処理を `channels.ts` のパターンに揃える
- 上記に対応するユニットテストを追加する

**やらないこと**
- server / common / OpenAPI registry の変更
- admin 画面の UI 変更
- 新規エンドポイントの追加
- `client.ts` の `openApiClient` 初期化コードの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `fetchSettings` が `openApiClient.GET("/api/admin/settings", { credentials: "include" })` を呼ぶ
2. `patchSetting` が `openApiClient.PATCH("/api/admin/settings", { body: { key, value }, credentials: "include" })` を呼ぶ
3. `fetchBatchLogs` が `openApiClient.GET("/api/admin/batch-logs", { credentials: "include" })` を呼ぶ
4. 各関数の外部インターフェース（戻り値型・queryKey）は変わらない
5. HTTP 失敗時に例外を throw し TanStack Query のエラー状態になる
6. `client/src/api/` 配下の実コードに生の `fetch(` 呼び出しが残っていない（`client.ts` の初期化・テストを除く）
7. `openApiClient` が内部で `globalThis.fetch` を呼ぶため、既存の `vi.stubGlobal("fetch", ...)` テストモックがそのまま流用できる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### アーキテクチャ

```
client/src/api/admin.ts        ← 修正対象（生 fetch → openApiClient）
client/src/api/batchLogs.ts    ← 修正対象（生 fetch → openApiClient）
client/src/api/client.ts       ← openApiClient の定義（変更なし）
server/openapi.json            ← 型の出所（変更なし）
```

### エラーハンドリング方針

- GET系（admin.ts / batchLogs.ts）: `openapi-fetch` は非2xx + 空ボディで `error=undefined` を返すケースがあるため、`error` チェックに加えて `response.ok` も確認する
- 戻り値が `undefined` の場合も考慮して安全な値を返す

### batchLogs の Date 変換

`BatchRunLogSchema.array().parse(data)` による Zod パースは維持する（`executedAt` を `Date` 型に変換するため）。撤去する場合は型・テストで `Date` であることを担保する必要があるが、維持する方針を選択した。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client のみ**

| ファイル | 変更内容 |
|---------|----------|
| `client/src/api/admin.ts` | `fetchSettings`・`patchSetting` を `openApiClient` 経由に変更 |
| `client/src/api/batchLogs.ts` | `fetchBatchLogs` を `openApiClient` 経由に変更 |
| `client/src/api/admin.test.ts` | `openApiClient` 経由であること（絶対 URL・正しい HTTP メソッド）を検証するテストを追加 |
| `client/src/api/batchLogs.test.ts` | 同上 |

## 6. テスト計画（TDD で書くテスト一覧）

### admin.test.ts
- `fetchSettings` が GET リクエストを絶対 URL で投げること
- `fetchSettings` が非2xx で例外を投げること
- `patchSetting` が PATCH リクエストを絶対 URL で投げること
- `patchSetting` が非2xx で例外を投げること

### batchLogs.test.ts
- `fetchBatchLogs` が GET リクエストを絶対 URL で投げること
- `fetchBatchLogs` が `BatchRunLogSchema` でパースし `executedAt` を `Date` 化すること
- `fetchBatchLogs` が非2xx で例外を投げること

## 7. リスク・未決事項

**なし**。対象 3 エンドポイントはすでに OpenAPI registry に登録済みで、server 側の変更は不要。実装は commit `157a9bd`（#110）で完了済みであり、本 Issue は当該コミットが develop に取り込まれた状態での正式クローズを目的とする。
