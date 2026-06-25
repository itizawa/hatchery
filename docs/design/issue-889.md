# 設計書: コミュニティ作成・編集をモーダルから専用ページに移行し画像アップロードを統合する (#889)

## 1. 目的 / 背景

現在、管理画面のコミュニティ作成（`AddCommunityDialog`）と編集（`EditCommunityDialog`）はモーダルダイアログで行っている。
フィールドが多く縦長になり操作性が悪化しており、また `CommunitiesTab.tsx:55` でダイアログを条件付きマウント（開くたびに再マウント）する回避策が必要な状態である。

#888（ワーカー作成・編集のページ化）と同じパターンで、コミュニティ管理を専用ページに移行する。

## 2. スコープ（やること / やらないこと）

### やること
- `/admin/communities/new` ページ（`AddCommunityScene`）の追加
- `/admin/communities/:communityId/edit` ページ（`EditCommunityScene`）の追加
- TanStack Router へのルート登録
- `CommunitiesTab` のボタンをページ遷移に変更
- `AddCommunityDialog` / `EditCommunityDialog` の廃止（ファイル削除）

### やらないこと
- slug 変更 API の追加（別 Issue で判断）
- コミュニティ削除機能（別 Issue）
- 管理者以外向けの UI 変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `AddCommunityScene` が `/admin/communities/new` でレンダリングされる（ルート登録）
2. `EditCommunityScene` が `/admin/communities/:communityId/edit` でレンダリングされる（ルート登録）
3. `AddCommunityScene` に「コミュニティを追加」見出しが表示される
4. `AddCommunityScene` に slug・name・description・generationInstruction の各入力欄が表示される
5. `AddCommunityScene` の各入力に Zod `.max()` と整合する maxLength が設定されている（#91）
6. `AddCommunityScene` で必須項目空のまま送信するとバリデーションエラーが表示される
7. `AddCommunityScene` で有効入力を送信すると `createCommunity` API が呼ばれ、成功後に編集ページへ遷移する
8. `AddCommunityScene` で 409 エラー時に slug 重複メッセージが表示される
9. `EditCommunityScene` に「コミュニティを編集」見出しが表示される
10. `EditCommunityScene` にコミュニティの現在値がフォームにセットされる
11. `EditCommunityScene` に slug が読み取り専用で表示される（TextField でなく Typography 等）
12. `EditCommunityScene` に `CommunityImageUpload`（cover / icon）が表示される
13. `EditCommunityScene` で保存ボタンを押すと `updateCommunity` API が呼ばれる
14. `EditCommunityScene` で存在しない ID の場合「コミュニティが見つかりません」を表示する
15. `CommunitiesTab` の「コミュニティを追加」ボタンが `/admin/communities/new` へナビゲートする
16. `CommunitiesTab` の「編集」ボタンが `/admin/communities/:communityId/edit` へナビゲートする
17. `CommunitiesTab` に `AddCommunityDialog` / `EditCommunityDialog` が表示されない
18. `CommunitiesTab.tsx:55` の条件付きマウント回避策（`{dialogOpen && ...}`）が不要になる
19. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### ルート構成
- `/admin/communities/new` → `adminCommunityNewRoute` → `AddCommunityScene`
- `/admin/communities/$communityId/edit` → `adminCommunityEditRoute` → `EditCommunityScene`
- どちらも `beforeLoad: requireAdminRoute`
- `lazyRouteComponent` でコード分割（#888 の worker ルートと同じ）

### AddCommunityScene
- `AddWorkerScene`（`routes/AddWorkerScene.tsx`）を参照実装として踏襲
- slug フィールド + `CommunityFormFields` 共通コンポーネント
- `useCreateCommunity()` ミューテーション
- 成功後 `navigate({ to: "/admin/communities/$communityId/edit", params: { communityId: created.id } })`
- エラー: 409 は「この slug はすでに使用されています」、その他は Snackbar
- `@tanstack/react-form` の `useForm` を使用

### EditCommunityScene
- `EditWorkerScene`（`routes/EditWorkerScene.tsx`）を参照実装として踏襲
- `useParams({ from: "/admin/communities/$communityId/edit" })` で ID 取得
- `useCommunities()` で一覧を取得、ID でフィルタ → not found を条件分岐で処理
  - API に単一コミュニティ GET エンドポイントが無いため一覧から取得
- slug は読み取り専用（`Typography` で表示、変更不可）
- `CommunityFormFields` + `CommunityImageUpload`（cover / icon）を同一ページに統合
- `useUpdateCommunity()` ミューテーション
- エラー: Snackbar で表示
- QueryBoundary でサスペンス・エラーバウンダリ包括

### CommunitiesTab
- `AddCommunityDialog` / `EditCommunityDialog` の import と JSX を削除
- `useNavigate()` を使って各ボタンをページ遷移に変更
- 条件付きマウント回避策（`{dialogOpen && ...}`）を削除
- 状態変数（`addOpen` / `dialogOpen` / `createdSnackbarOpen`）を削除

## 5. 影響範囲 / 既存への変更

- **client/src/routes/** — `AddCommunityScene.tsx`・`EditCommunityScene.tsx` 新設
- **client/src/router.tsx** — ルート 2 件追加・lazy import 2 件追加
- **client/src/components/CommunitiesTab.tsx** — ボタン動作変更・dialog 削除
- **client/src/components/AddCommunityDialog.tsx** — 削除
- **client/src/components/EditCommunityDialog.tsx** — 削除
- **client/src/components/AddCommunityDialog.test.tsx** — 削除
- **client/src/components/EditCommunityDialog.test.tsx** — 削除
- **client/src/components/CommunitiesTab.test.tsx** — ナビゲーションテストに更新
- **client/src/routes/AddCommunityScene.test.tsx** — 新設
- **client/src/routes/EditCommunityScene.test.tsx** — 新設

`CommunityFormFields.tsx` / `CommunityImageUpload.tsx` / `api/communities.ts` は変更なし。

## 6. テスト計画

### AddCommunityScene.test.tsx
- 見出し表示
- 全フィールド（slug / name / description / generationInstruction）の表示
- 「一覧に戻る」リンクの表示
- maxLength 整合（#91）
- 必須バリデーション
- 送信 → createCommunity 呼び出し
- 送信成功 → 編集ページ遷移
- 409 → slug 重複エラー表示

### EditCommunityScene.test.tsx
- 見出し表示
- 既存値のフォーム反映
- slug 読み取り専用表示
- CommunityImageUpload の表示
- 保存 → updateCommunity 呼び出し
- 「一覧に戻る」リンクの表示
- 不明 ID → 「コミュニティが見つかりません」表示

### CommunitiesTab.test.tsx（更新）
- 一覧表示（既存テストを維持）
- 「コミュニティを追加」ボタン → navigate to new page
- 「編集」ボタン → navigate to edit page
- dialog は表示されないこと

## 7. リスク・未決事項

- `EditCommunityScene` は `useCommunities()` で全一覧を取得してフィルタしているため、コミュニティ数が増えると不効率になる可能性がある。現状 MVP では問題ない。将来的に `GET /api/admin/communities/:id` エンドポイントを追加して解消する（別 Issue）。
- slug 変更 API がないため、編集ページでは slug は読み取り専用。変更したい場合は別 Issue で API を追加する。
