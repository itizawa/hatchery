# 設計書: client/src/api/workers.ts の TanStack Query フックのテストを追加する (#379)

## 1. 目的 / 背景

`client/src/api/workers.ts` は Worker 一覧取得・更新・画像アップロードのフック群を提供するが、
`client/src/api/workers.test.ts` が存在しない。同配下の他 API ファイルにはテストがある中、
`workers.ts` だけが未テストで、エラーハンドリング・`invalidateQueries`・mutation の引数組み立てが
回帰検証されていない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/api/workers.test.ts` を新規追加
- `useBotWorkers`・`useUpdateWorker`・`uploadWorkerImage`（`useUploadWorkerImage`）のテスト追加

**やらないこと:**
- `workers.ts` の `as unknown as Worker` 型キャスト解消（別 Issue）
- `workers.ts` 本体のロジック変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `useBotWorkers`: 200 で Worker 配列を返す / エラー応答で `error` 状態になる
2. `useUpdateWorker`: 正しい path/body で PATCH が呼ばれ、成功後に `BOT_WORKERS_QUERY_KEY` が invalidate される / 失敗時に reject する
3. `uploadWorkerImage`: multipart で POST し、成功でレスポンス（`{ id, imageUrl }`）を返す / 失敗時にエラーメッセージを throw する
4. ネットワークに実アクセスしない（`vi.stubGlobal("fetch", ...)` でモック）
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

**テスト戦略:**
- `useBotWorkers` / `useUpdateWorker` / `useUploadWorkerImage` はフック（`useQuery`/`useMutation`）のため、
  `renderHook` + `QueryClientProvider` ラッパーで実行し、`waitFor` で非同期状態変化を待つ
- `uploadWorkerImage` は plain async function なので `vi.stubGlobal("fetch", ...)` でシンプルにテスト
- 既存パターンに合わせて `vi.stubGlobal("fetch", fetchMock)` を使用（MSW サーバー起動は不要）

**QueryClient の設定:**
- `retry: false`（デフォルトの3回リトライを無効化してテストを高速化）
- 各テストで新しい `QueryClient` を生成してテスト間の状態汚染を防ぐ

## 5. 影響範囲

- `client/src/api/workers.test.ts`（新規追加のみ）
- `client` ワークスペースのみ変更

## 6. テスト計画

```
describe("useBotWorkers (GET /api/workers)")
  it: 200 のとき Worker 配列を返す
  it: エラー応答のとき error 状態になる

describe("useUpdateWorker (PATCH /api/workers/{id})")
  it: 正しい path/body で PATCH が呼ばれ成功後に BOT_WORKERS_QUERY_KEY を invalidate する
  it: 非 2xx のとき mutation が reject する

describe("uploadWorkerImage (POST /api/admin/workers/{id}/image)")
  it: multipart/form-data で POST し { id, imageUrl } を返す
  it: 非 2xx のときエラーメッセージを throw する
```

## 7. リスク・未決事項

- `useQuery` のデフォルト `staleTime: 0` により `waitFor` で非同期待機が必要
- `queryClient.invalidateQueries` の検証: `vi.spyOn` で `queryClient.invalidateQueries` を監視する
