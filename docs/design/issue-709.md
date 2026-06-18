# 設計書: client/src/api/workers.ts の TanStack Query フックのテストを追加する (#709)

## 1. 目的 / 背景

`client/src/api/workers.ts` の `useBotWorkers`・`useUpdateWorker` テストは `workers.test.tsx` に実装済みだが、
ワーカーの作成・削除を担う `useCreateAdminWorker`・`useDeleteWorker`（`admin.ts` に実装）の useMutation テストが
`admin.test.ts` に存在しない。特に成功時の `BOT_WORKERS_QUERY_KEY` invalidation が未テスト。

## 2. スコープ（やること / やらないこと）

やること:
- `admin.test.ts` に `useCreateAdminWorker` の useMutation テストを追加（POST → BOT_WORKERS_QUERY_KEY invalidate）
- `admin.test.ts` に `useDeleteWorker` の useMutation テストを追加（DELETE → BOT_WORKERS_QUERY_KEY invalidate）

やらないこと:
- `workers.test.tsx` の既存テストの変更
- `useAdminWorkers`（useSuspenseQuery）のテスト（別 Issue 対象）
- admin.ts の他フックのテスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useCreateAdminWorker`: `POST /api/admin/workers` が成功したとき `BOT_WORKERS_QUERY_KEY` を invalidate する
2. `useDeleteWorker`: `DELETE /api/admin/workers/:id` が成功したとき `BOT_WORKERS_QUERY_KEY`（および `ADMIN_WORKERS_QUERY_KEY`）を invalidate する
3. `useCreateAdminWorker`: 非 2xx のとき mutation が reject する
4. `useDeleteWorker`: 非 2xx のとき mutation が reject する

## 4. 設計方針

- `workers.test.tsx` の `createWrapper()` / `createSuspenseWrapper()` パターンに準拠
- `vi.stubGlobal("fetch", ...)` で fetch をスタブし HTTP 応答を制御
- `vi.spyOn(queryClient, "invalidateQueries")` で cache invalidation を検証
- `BOT_WORKERS_QUERY_KEY` は `workers.ts` から import する

## 5. 影響範囲 / 既存への変更

- `client/src/api/admin.test.ts` にテストを追加（既存の fetchSettings/patchSetting テストは変更しない）
- 他ファイルの変更なし

## 6. テスト計画（TDDで書くテスト一覧）

1. `useCreateAdminWorker` - POST 成功 → BOT_WORKERS_QUERY_KEY + ADMIN_WORKERS_QUERY_KEY を invalidate
2. `useCreateAdminWorker` - 非 2xx → mutation が reject
3. `useDeleteWorker` - DELETE 成功 → BOT_WORKERS_QUERY_KEY + ADMIN_WORKERS_QUERY_KEY を invalidate
4. `useDeleteWorker` - 非 2xx → mutation が reject

## 7. リスク・未決事項

- `useCreateWorker` という名前のフックは存在しないため、`useCreateAdminWorker` を対象にする
- 既存の `workers.test.tsx` の `useBotWorkers`・`useUpdateWorker` テストは満たされているため、本実装は admin.ts の mutation フックを対象とする
