# Issue #476 設計書: SettingsScene / EditWorkerDialog の保存失敗時にエラー内容を伝える

## 背景・目的

`client/src/routes/SettingsScene.tsx`（`ApiTokenSettings`）と `client/src/components/EditWorkerDialog.tsx` は
mutation 失敗時に汎用の固定文言（「APIキーの保存に失敗しました」「ワーカーの更新に失敗しました」）を出すだけで、
**何が原因か（バリデーション失敗・権限・サーバエラー・ネットワーク断）が一切伝わらない**。
加えて `errorOpen` のローカル state と mutation の `isError` を二重管理しており、同期ズレの懸念がある。

本 Issue では、

1. 保存失敗時に **サーバから返るエラーメッセージ**（`{ error: string }`）または種別に応じた文言を提示する。
2. エラー状態を mutation の `isError` / `error` に集約し、`errorOpen` 独立 state を廃して二重管理を解消する。
3. 成功時挙動（`form.reset()` + 成功 Snackbar / ダイアログクローズ）を退行させない。

## 現状の問題詳細

- サーバ（`server/src/middleware/errorHandler.ts`）はエラーを `{ error: string }`（例: `AppError.message`・`"InternalServerError"`・`"PayloadTooLarge"`）で返す。
- だが client の API ヘルパ（`patchSetting` / `useUpdateWorker` の mutationFn / `setWorkerCommunities`）は
  `throw new Error("PATCH ... failed: <status>")` のように **ステータスコードだけの文言に潰しており、サーバの error メッセージを捨てている**。
- UI 側は `catch { setErrorOpen(true) }` で固定文言を出すのみ。

## 方針

### 1. サーバの error メッセージを拾う API ヘルパへ修正

`{ error }` ボディを読み、メッセージを `Error` に乗せて throw する。openapi-fetch は非 2xx 時に
`error`（パース済みボディ）を返すため、それを使う。`{ error: string }` 形なら `error.error` を採用。

対象:
- `client/src/api/admin.ts` の `patchSetting`
- `client/src/api/workers.ts` の `useUpdateWorker` の mutationFn
- `client/src/api/workerCommunities.ts` の `setWorkerCommunities`

### 2. エラーメッセージ抽出ユーティリティ `getApiErrorMessage`

`client/src/api/errors.ts` に純粋関数を新設し、unit テストする（common ではなく client。openapi-fetch の
error 形・`Error` インスタンス両対応の client 固有ロジックのため）。

```ts
export function getApiErrorMessage(error: unknown, fallback = "保存に失敗しました。時間をおいて再度お試しください。"): string
```

- `Error` インスタンス → `error.message`（空なら fallback）
- `{ error: string }` 形のオブジェクト（openapi-fetch の error）→ その文字列
- それ以外（null / undefined / 不明形）→ fallback

### 3. UI を mutation 状態駆動に変更（二重 state 廃止）

- `ApiTokenSettings`: `errorOpen` state を廃止。エラー Snackbar の `open` を `saveMutation.isError` に、
  本文を `getApiErrorMessage(saveMutation.error)` に。閉じる操作は `saveMutation.reset()`。
  再送信成功で `isError=false` になり残留しない。受け入れ条件 2 を満たす。
- `EditWorkerDialog`: `errorOpen` state を廃止。`updateMutation` / `setCommunitiesMutation` のどちらかが
  `isError` のとき Snackbar を開き、`error` からメッセージを出す。閉じる操作で両 mutation を `reset()`。
  ダイアログ再オープン時の残留・欠落を避けるため、`key` 再マウント（既存）に加え mutation 状態を参照。

`onSubmit` の `try/catch` は **`mutateAsync` の reject を握りつぶさないため残す**（form の onSubmit が reject すると
未処理 Promise 警告になる）。ただし catch では `setErrorOpen` を呼ばず、エラー表示は mutation 状態に委ねる。

## 受け入れ条件 → 入出力（テスト）

| # | 条件 | テスト |
|---|------|--------|
| 1 | 保存失敗時にエラーメッセージを表示 | `errors.test.ts`（抽出）/ `SettingsScene.test.tsx`・`EditWorkerDialog.test.tsx`（サーバ文言が画面に出る） |
| 2 | mutation 状態で表現・二重管理回避 | `SettingsScene.test.tsx`（失敗→成功で残留しない）/ `EditWorkerDialog.test.tsx`（失敗→再オープンで残留しない） |
| 3 | 成功時挙動を退行させない | 既存テスト（`form.reset` / 成功 Snackbar / `onClose`）を維持 |
| 4 | RTL に失敗ケース追加 | 上記 2 ファイルに失敗→メッセージ表示テスト追加 |
| 5 | `@tanstack/react-form` 維持 | フォーム構造は変更しない |
| 6 | build/test/lint 緑 | CI |

## スコープ外

- AccountScene のエラー表示欠落（#472 で別途）。
- サーバ側のエラーメッセージ文言の国際化・粒度向上（今回はサーバが返す文字列をそのまま表示）。

## ユーザー可視挙動の変化と e2e

保存失敗時に「具体的なエラーメッセージ」が出るようになる（観察可能挙動の変化）。
`e2e/admin/usecases.md` に保存失敗時のエラー表示ユースケースを追記し、`e2e/usecases.md` のサマリへ反映する。
