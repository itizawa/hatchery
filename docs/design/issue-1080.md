# 設計書: ワーカー編集の保存完了時にSnackbarを表示し一覧画面へ自動遷移する (#1080)

## 1. 目的 / 背景

`client/src/routes/EditWorkerScene.tsx` の保存処理は成功時に何もフィードバックしない。保存が完了したのかどうかがUI上わからず、一覧に戻る操作もユーザーが手動で行う必要がある。保存成功をSnackbarで明示し、一覧画面（`/admin?tab=users`、"ワーカー管理" タブ）へ自動的に戻すことでUXを改善する。

## 2. スコープ（やること / やらないこと）

- やること: `EditWorkerScene` の保存成功時に一覧画面（`/admin` の `tab=users`）へ自動遷移し、遷移先で保存成功のSnackbarを一度だけ表示する。保存失敗時は現在の画面に留まり、既存のエラーSnackbar挙動を維持する。
- やらないこと: `EditCommunityScene.tsx` の同様の欠落修正（別Issue候補）。アプリ全体で使える共通Snackbar/Toastコンテキストの新設。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `updateMutation.mutateAsync` と（`canEditCommunities` の場合）`setCommunitiesMutation.mutateAsync` の両方が成功した場合のみ、`/admin` へ `search: { tab: "users", workerSaved: 1 }` 付きで遷移する。
2. 遷移先の一覧画面（`AdminWorkerTable`、`tab=users`）は `workerSaved=1` を検知したら「ワーカーを保存しました」の成功Snackbar（`severity="success"`）を表示する。
3. 一覧画面はSnackbar表示と同時に `workerSaved` をURL検索パラメータから除去する（`replace: true` でナビゲーション履歴を汚さない）ことで、再訪問・戻る操作で再表示されないようにする。
4. 保存が失敗した場合（`updateMutation` または `setCommunitiesMutation` がエラー）は画面遷移を行わない。既存のエラーSnackbar（`isSaveError`）の挙動は変更しない。

## 4. 設計方針

- 遷移後に `EditWorkerForm` はアンマウントされるため、成功メッセージは画面間で引き継ぐ必要がある。ルーターの `state` オプションは対象パッケージ（`@tanstack/history`）の型がclientから型解決できず、素朴な `declare module` 拡張はモジュール解決に失敗するリスクが高いため採用しない。
- 既存コードで実績のあるURL検索パラメータによる一時フラグ方式（`RootSearch` の `login=1` パターン・`client/src/router.tsx`）を踏襲する。`/admin` の `validateSearch` に任意の `workerSaved?: 1` を追加する。
- `AdminWorkerTable.tsx`（`tab=users` の中身、"ワーカー管理" タブ）の `AdminWorkerTableInner` で `useSearch({ from: "/admin" })` の `workerSaved` を読み、真であれば成功Snackbarをローカル state で表示しつつ、`navigate({ to: "/admin", search: { tab: "users" }, replace: true })` でURLからフラグを除去する。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: `client`。

- `client/src/router.tsx`: `/admin` route の `validateSearch` に `workerSaved?: 1` を追加。
- `client/src/routes/EditWorkerScene.tsx`: 保存成功時に `useNavigate` で `/admin?tab=users&workerSaved=1` へ遷移。
- `client/src/components/AdminWorkerTable.tsx`: `workerSaved` 検知で成功Snackbar表示 + URLからのフラグ除去。

## 6. テスト計画（TDDで書くテスト一覧）

- `EditWorkerScene.test.tsx`
  - 保存成功時に `navigate({ to: "/admin", search: { tab: "users", workerSaved: 1 } })` が呼ばれる。
  - 保存失敗時は `navigate` が呼ばれない。
- `AdminWorkerTable.test.tsx`
  - `workerSaved: 1` のとき「ワーカーを保存しました」のSnackbar/Alertが表示される。
  - `workerSaved: 1` のとき `navigate` が `search: { tab: "users" }`, `replace: true` で呼ばれ、フラグを除去する。
  - `workerSaved` が無いとき（既定値）Snackbarは表示されない。

## 7. リスク・未決事項

- なし。
