# 設計書: 管理画面のワーカー一覧をサーバーサイドページネーション（10件/ページ）に変更する (#545)

## 1. 目的 / 背景

管理画面のワーカー一覧（`AdminWorkerTable`）は現在 `GET /api/workers` で全件取得している。
ワーカー数増加に伴う表示肥大化を防ぐため、サーバーサイドページネーションを実装する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `GET /api/workers` に `page`・`limit` クエリパラメータを追加
- レスポンス形式を `{ workers, total, page, limit }` に変更（デフォルト: page=1, limit=100）
- `common/` に `WorkerListQuerySchema` / `WorkerListResponseSchema` を追加
- `server/` の WorkerRepository インターフェースに `listBotWorkersPaginated` を追加
- `client/` の `fetchAdminWorkers` / `useAdminWorkers` を page 対応に更新
- `AdminWorkerTable` に `TablePagination`（MUI）を追加し 10件/ページで表示
- `useBotWorkers` を新しいレスポンス形式（`.workers` 抽出）に対応
- OpenAPI スキーマ・スナップショット fixture 更新

**やらないこと**:
- `AdminWorkerTab`（`useBotWorkers` を使う AI ワーカー一覧タブ）へのページネーション UI 追加
- ページサイズ変更 UI（10件固定）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/workers?page=1&limit=10` で `{ workers, total, page: 1, limit: 10 }` が返る
2. 15件のワーカーが存在するとき `page=1&limit=10` で `workers` が 10件、`total` が 15
3. 15件のワーカーが存在するとき `page=2&limit=10` で `workers` が 5件、`total` が 15
4. `page`・`limit` なしのリクエストは従来通り全件を `{ workers, total, page: 1, limit: 100 }` 形式で返す
5. `fetchAdminWorkers(page, limit)` が paginated レスポンスを返す
6. `AdminWorkerTable` で 10件超のワーカーが存在するとき最初のページは 10件のみ表示される
7. `AdminWorkerTable` で 総件数（total）が UI に表示される
8. `AdminWorkerTable` でページ変更後に対応するページのデータが取得・表示される
9. `pnpm turbo run build test lint` がすべて緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### レスポンス形式の変更

`GET /api/workers` のレスポンスを常に統一形式に変更する（後方互換をデフォルト値で担保）:

```typescript
// 旧: Worker[]
// 新: { workers: Worker[], total: number, page: number, limit: number }
// デフォルト: page=1, limit=100
```

`useBotWorkers` は `.workers` を抽出するよう更新する（AdminWorkerTab のページネーション UI は別 Issue）。

### common: 新スキーマ

`common/src/domain/worker/worker.ts` に追加:
- `WORKER_PAGINATION_LIMIT_MAX = 100`
- `WorkerListQuerySchema`: `{ page?: number(min:1,max:9999), limit?: number(min:1,max:100), includeDeleted?: boolean }`
- `WorkerListResponseSchema`: `{ workers: Worker[], total: number, page: number, limit: number }`

### server: WorkerRepository インターフェース拡張

`listBotWorkersPaginated(page: number, limit: number): Promise<{ workers: WorkerRecord[]; total: number }>`
をインターフェース・in-memory・Prisma 実装に追加。

### server: ルート変更

`GET /api/workers`: `WorkerListQuerySchema.safeParse(req.query)` → 400 or `{ workers, total, page, limit }` を返す。
`includeDeleted` は `WorkerListQuerySchema` に統合する。

### client: API レイヤー

- `fetchAdminWorkers(page: number, limit: number)`: `GET /api/workers?page=N&limit=N` → paginated response
- `useAdminWorkers(page: number)`: `page` を state として受け取り queryKey に含める
- `useBotWorkers`: レスポンスから `.workers` を抽出するよう修正

### client: AdminWorkerTable

- `page` state（useState, 0-indexed for TablePagination）を管理
- `WorkerTable` の下部に `TablePagination` を配置（rowsPerPage=10固定、総件数表示）
- `useAdminWorkers` に `page+1`（1-indexed）を渡す

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更種別 |
|---|---|---|
| common | `domain/worker/worker.ts` | スキーマ追加 |
| server | `persistence/workerRepository.ts` | インターフェース拡張 |
| server | `persistence/prismaWorkerRepository.ts` | 実装追加 |
| server | `routes/workers.ts` | レスポンス形式変更 |
| server | `openapi/registrations/registerWorkers.ts` | レスポンス更新 |
| server | `openapi/__fixtures__/openapi.baseline.json` | スナップショット更新 |
| client | `components/uiParts/index.ts` | TablePagination 追加 |
| client | `api/admin.ts` | fetchAdminWorkers/useAdminWorkers 変更 |
| client | `api/workers.ts` | useBotWorkers 変更 |
| client | `components/AdminWorkerTable.tsx` | TablePagination 追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### server routes/workers.test.ts（追加）
- `GET /api/workers?page=1&limit=10` でページネーション済みオブジェクトを返す
- 15件存在するとき page=1&limit=10 で workers が 10件・total が 15
- 15件存在するとき page=2&limit=10 で workers が 5件・total が 15
- page/limit なしでも `{ workers, total }` 形式を返す（full list）
- 既存テストのレスポンス形式を `{ workers, total }` 形式に更新

### client api/admin.test.ts（追加）
- `fetchAdminWorkers(1, 10)` がページネーション済みレスポンスを返す
- page/limit パラメータが URL に含まれること

### client components/AdminWorkerTable.test.tsx（追加）
- 10件超のデータがあるとき最初のページは 10件のみ表示される
- 総件数が TablePagination に表示される
- ページ変更後に次ページのデータが取得される

## 7. リスク・未決事項

- `openapi.baseline.json` のスナップショット更新が必要（`pnpm --filter @hatchery/server openapi` 再生成で対応）
- `useBotWorkers` の型変更により既存の `workers.test.tsx` も更新が必要
