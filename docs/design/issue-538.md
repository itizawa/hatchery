# Issue #538 設計書: 旧仮想オフィス/ChannelScene 由来の死蔵 client コード削除

## 背景

製品は Reddit 風 UI へ移行（ADR-0018/0019、#307・#330）し、旧「仮想オフィス」「ChannelScene」は存在しない。その時代の遺物がどこからも import されないまま client に残存しているため一掃する。純粋な削除中心のリファクタで、ユーザー可視の振る舞いは変わらない。

## 受け入れ条件（Issue #538 より）

1. `client/src/components/CharacterSprite.tsx`（+ `CharacterSprite.test.tsx`）・`client/src/utils/office.ts`（+ `office.test.ts`）を削除する。
2. `client/src/api/workers.ts` の `useAllBotWorkers` / `BOT_WORKERS_ALL_QUERY_KEY` / 素の `uploadWorkerImage`（exported 関数）を削除する。
3. `client/src/api/admin.ts` の廃止画面（OfficeScene・ChannelScene）を指す stale コメントを現状に合わせて修正する。
4. `pnpm turbo run build typecheck test lint` が緑（参照切れが無い）。

## 削除前検証（grep による外部参照確認）

- `CharacterSprite` の参照: 自身（`CharacterSprite.tsx` / `.test.tsx`）のみ。本番コンポーネントからの import 0。
- `utils/office`: `CharacterSprite.tsx` の `import type { Position }` のみ（連鎖死蔵）。
- `useAllBotWorkers` / `BOT_WORKERS_ALL_QUERY_KEY`: `workers.ts`（定義）と `workers.test.tsx`（テスト）のみ。本番コードからの参照 0。
- 素の `uploadWorkerImage`（exported 関数）: `workers.ts`（定義）・`workers.test.tsx`（テスト）のみが直接参照。本番コードは `WorkerImageUpload.tsx` が **フック版 `useUploadWorkerImage` のみ**を使用。`WorkerImageUpload.test.tsx` は `useUploadWorkerImage` を `vi.mock` でモックしており、raw 関数には依存しない。
- `admin.ts:124` の `OfficeScene・ChannelScene で共有` コメントは廃止画面を指す stale コメント。

## 設計判断

### 1. CharacterSprite / utils/office の削除

4 ファイル（`CharacterSprite.tsx`・`CharacterSprite.test.tsx`・`utils/office.ts`・`office.test.ts`）を丸ごと削除する。`utils/office.ts` の唯一の利用者が `CharacterSprite.tsx`（`Position` 型）なので連鎖して安全に削除できる。

### 2. workers.ts の死蔵 API 削除

- `useAllBotWorkers` と `BOT_WORKERS_ALL_QUERY_KEY` を削除する。`useBotWorkers`（現行 AdminWorkerTab 等が使用）は残す。
- 素の exported 関数 `uploadWorkerImage` を削除する。ただし**フック版 `useUploadWorkerImage` が内部でこの関数を呼んでいる**ため、単純削除では参照切れになる。アップロードロジックを `useUploadWorkerImage` の `mutationFn` に**インライン化**して、外部に公開する関数を無くす（公開 API を `useUploadWorkerImage` フックのみに絞る）。
  - これに伴い `clientEnv` import は `useUploadWorkerImage` 内へ移動（用途は変わらず維持）。`multipart/form-data` を openapi-fetch が扱えないため直接 `fetch` する実装と、baseUrl のフォールバック（#78 クロスオリジン配信）は完全に維持する。
- `buildApiErrorMessage` import は `useUpdateWorker` が引き続き使用するため残す。

### 3. admin.ts の stale コメント修正

`useCreateAdminWorker` の `onSuccess` 内コメントから廃止画面名（OfficeScene・ChannelScene）を除去し、現行の意味（管理画面の一覧キャッシュ + GET /api/workers を参照する Bot Worker 一覧キャッシュの両方を無効化する）に合わせて書き換える。invalidate ロジック自体（`ADMIN_WORKERS_QUERY_KEY` / `BOT_WORKERS_QUERY_KEY` の 2 本）は現行どおり残す。

## TDD 方針

純粋な削除中心のリファクタのため、新規テストは追加しない（受け入れ条件はテストに落とせる挙動変更を含まない）。代わりに以下で回帰を担保する:

- 削除対象を参照していたテスト（`workers.test.tsx` の `useAllBotWorkers` describe、`uploadWorkerImage` describe）を削除/整理し、残す API（`useBotWorkers`・`useUpdateWorker`・`useUploadWorkerImage`）のテストは維持する。
- `useUploadWorkerImage` のテスト（成功時 invalidate）が、インライン化後も緑であることを確認する（フックの外部契約は不変）。
- `pnpm turbo run build typecheck test lint` を全緑にして参照切れ・型エラーが無いことを確認する。

## スコープ外

- `GET /api/workers` エンドポイント自体（AdminWorkerTab で使用中のため残す）。
- フック版 `useUploadWorkerImage` の外部契約（引数・戻り値・invalidate 挙動）は変更しない。

## e2e への影響

ユーザー可視の振る舞いは一切変わらない（死蔵コード削除と stale コメント修正のみ）。`e2e/` ユースケースの更新は不要。
