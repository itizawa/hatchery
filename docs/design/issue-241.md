# 設計書: 初回表示時の真っ白状態を解消するスケルトン UI を各画面に追加する (#241)

## 1. 目的 / 背景

初回表示時・データ取得中に認証済み画面の一部が「真っ白」になる。既存の `ChannelListSkeleton` / `ChannelViewSkeleton` はサイドバーとチャンネルビューに適用済みだが、以下の箇所が未対応。本 Issue ではこれらを MUI `Skeleton` で埋め、一貫した UX にする。

## 2. スコープ（やること / やらないこと）

### やること

- `SettingsScene` 内 `ApiTokenSettings`: `useAdminSettings()` の `isLoading` 中に `Skeleton` 代替表示
- `SettingsScene` 内 `BatchLogs`: `useBatchLogs()` の `isLoading` 中にテーブル行を `Skeleton` 代替表示
- `EmployeeTable`: `isLoading` prop を追加してスケルトン行描画に対応
- `InvitationsTab`: 「読み込み中...」テキストを MUI `Skeleton` 行に置き換え
- `AccountScene`: `useAuth()` の `isLoading` 中にフォームフィールドを `Skeleton` で代替表示
- `RootLayout`: `<Outlet />` を `<Suspense fallback={<MainContentSkeleton />}>` で囲む
- `MainContentSkeleton` コンポーネント（新規）を `client/src/components/` に追加

### やらないこと（スコープ外）

- `UserFooter.tsx` の対応: PR #243 の AppHeader 追加リファクタリングにより当該ファイルは削除済み。本 Issue のスコープ外とする。
- ErrorBoundary の追加
- ページ遷移トランジションアニメーション
- OfficeScene のスケルトン（別 Issue 依存）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `EmployeeTable` が `isLoading` prop を受け取り、`true` のとき `data-testid="employee-table-skeleton-item"` のスケルトン行を描画する
2. `InvitationsTab` の `isLoading` 中に「読み込み中...」テキストを表示せず、スケルトン要素 (`data-testid="invitations-skeleton-item"`) を表示する
3. `AccountScene` の `useAuth()` `isLoading` 中にフォームフィールドではなく `data-testid="account-scene-skeleton"` のスケルトンを表示する
4. `ApiTokenSettings` の `useAdminSettings()` `isLoading` 中に `data-testid="api-token-skeleton"` のスケルトンを表示する
5. `BatchLogs` の `useBatchLogs()` `isLoading` 中に `data-testid="batch-logs-skeleton"` のスケルトンを表示する
6. `MainContentSkeleton` コンポーネントがクラッシュせずレンダリングでき、`data-testid="main-content-skeleton-item"` の要素を持つ
7. `RootLayout` の `<Outlet />` が `<Suspense>` で囲まれ `MainContentSkeleton` がフォールバックとして設定されている
8. `pnpm test` 全緑・`pnpm lint` 通過

## 4. 設計方針

- 既存の `ChannelListSkeleton.tsx` / `ChannelViewSkeleton.tsx` と同じ命名・構造で `MainContentSkeleton.tsx` を追加
- `EmployeeTable` の `isLoading` prop は optional（`false` デフォルト）で後方互換性を維持
- `InvitationsTab` の Skeleton 行数は既存の `ChannelListSkeleton` と同程度（4行）
- `AccountScene` / `ApiTokenSettings` / `BatchLogs` は early return パターンで loading 状態を分岐
- `RootLayout` は既存のルート固有 Suspense（`ChannelScene` 等）はそのまま維持（二重 Suspense は内側が優先）

## 5. 影響範囲

- `client/src/components/`: EmployeeTable.tsx, InvitationsTab.tsx, MainContentSkeleton.tsx（新規）
- `client/src/routes/`: AccountScene.tsx, RootLayout.tsx, SettingsScene.tsx

## 6. テスト計画

| テスト | ファイル | 種別 |
|--------|----------|------|
| MainContentSkeleton レンダリング・スケルトン要素確認 | MainContentSkeleton.test.tsx（新規） | 存在確認 |
| EmployeeTable isLoading=true でスケルトン行 | EmployeeTable.test.tsx（追加） | 単体 |
| InvitationsTab isLoading=true でスケルトン表示（"読み込み中..."なし） | InvitationsTab.test.tsx（追加） | 単体 |
| AccountScene isLoading=true でスケルトン表示 | AccountScene.test.tsx（追加） | 単体 |

## 7. リスク・未決事項

- UserFooter.tsx が削除済みのため AC #1 は非適用（スコープ外）
- SettingsScene の ApiTokenSettings・BatchLogs はコンポーネントが非公開のため、SettingsScene.test.tsx 経由でのテストは mock 設定が複雑。実装は行いテストは後続 Issue 対応とする
