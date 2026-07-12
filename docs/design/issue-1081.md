# 設計書: コミュニティ編集の保存完了時にSnackbarを表示し一覧画面へ自動遷移する (#1081)

## 1. 目的 / 背景

`EditCommunityScene.tsx` の `EditCommunityForm` は保存成功時に何もフィードバックを返さない（エラー時のみ Snackbar 表示）。#1080（ワーカー編集）で同型の問題を解消済みであり、同じ実装パターン（保存成功 Snackbar + 一覧画面への自動遷移 + 遷移先へのメッセージ引き継ぎ）をコミュニティ編集にも適用する。

## 2. スコープ（やること / やらないこと）

- やること:
  - `EditCommunityForm` の保存成功時に `/admin?tab=communities&communitySaved=1` へ遷移する。
  - `CommunitiesTab`（一覧画面）で `communitySaved` フラグを検知し、成功 Snackbar を一度だけ表示してから URL からフラグを除去する。
  - `/admin` ルートの `validateSearch` に `communitySaved` を追加する（#1080 の `workerSaved` と同じパターン）。
- やらないこと:
  - アプリ全体で使える共通 Snackbar/Toast コンテキストの新設（Issue 補足に明記の通りスコープ外）。
  - `CommunityWorkersEditSection`（所属ワーカー編集・独立した保存単位）への同種フィードバック追加（Issue 受け入れ条件はコミュニティ本体の保存のみを対象とする）。
  - 保存失敗時の挙動変更（既存のエラー Snackbar は変更しない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `EditCommunityForm` の保存が成功したら `navigate({ to: "/admin", search: { tab: "communities", communitySaved: 1 } })` が呼ばれる。
2. `EditCommunityForm` の保存が失敗したら `navigate` は呼ばれない（既存挙動を維持）。
3. `CommunitiesTab` が `communitySaved: 1` を検知したら「コミュニティを保存しました」の成功 Snackbar を表示する。
4. `CommunitiesTab` が `communitySaved: 1` を検知したら `navigate({ to: "/admin", search: { tab: "communities" }, replace: true })` でフラグを URL から除去する（再訪問時の再表示防止）。
5. `communitySaved` が無いときは成功 Snackbar は表示されない。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`#1080`（`EditWorkerScene` → `AdminWorkerTable` の `workerSaved` フラグ）と全く同型のパターンを踏襲する。

- `client/src/router.tsx`: `adminRoute` の `validateSearch` 戻り値型に `communitySaved?: 1` を追加し、`parseTruthySearchFlag` で判定して `workerSaved` と同様に返す。
- `client/src/routes/EditCommunityScene.tsx`: `EditCommunityForm` に `useNavigate` を導入し、`onSubmit` の成功パスで一覧画面へ遷移する。
- `client/src/components/CommunitiesTab.tsx`: `useSearch({ from: "/admin" })` で `communitySaved` を取得し、`useEffect` で Snackbar 表示 + フラグ除去 navigate を行う（`AdminWorkerTable` の実装をそのまま踏襲）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `client`: `router.tsx` / `EditCommunityScene.tsx` / `CommunitiesTab.tsx` の変更のみ。`common` / `server` への変更はない。

## 6. テスト計画（TDDで書くテスト一覧）

- `EditCommunityScene.test.tsx`:
  - 保存成功時に `/admin?tab=communities&communitySaved=1` へ遷移することを検証する。
  - 保存失敗時に遷移しないことを検証する（既存の挙動を維持することの回帰防止）。
- `CommunitiesTab.test.tsx`:
  - `communitySaved=1` のとき成功 Snackbar が表示されることを検証する。
  - `communitySaved=1` のとき `navigate` でフラグが除去されることを検証する。
  - `communitySaved` が無いとき Snackbar が表示されないことを検証する。

## 7. リスク・未決事項

特になし（#1080 で確立済みのパターンをそのまま横展開するのみ）。

### セルフレビューでの修正（develop マージ前）

`/code-review`（high effort）で以下2点の指摘が確認され、実装 PR 内で修正済み:

1. **[correctness] `useSavedFlagSnackbar` の `navigate` が search 全体を `{ tab }` で置き換えていた**ため、`workerSaved` と `communitySaved` が同時に URL に存在する場合（例: タブ切替や直接 URL アクセスで両フラグが並存）、片方のフラグを検知した hook の navigate がもう片方のフラグを消費前に消してしまう不具合があった。`useLoginModal`（#588）と同様に `search` を関数更新（`(prev) => { const next = {...prev}; delete next[flagKey]; return next; }`）にし、自分の `flagKey` だけを取り除くよう修正した（呼び出し側は `tab` の代わりに `flagKey: "workerSaved" | "communitySaved"` を渡す）。
2. **[reuse] `CommunitiesTab.tsx` と `AdminWorkerTable.tsx` の Snackbar/Alert JSX が重複**していたため、`client/src/components/SavedFlagSnackbar.tsx` に共通の表示コンポーネントとして切り出した。
