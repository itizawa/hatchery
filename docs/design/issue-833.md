# 設計書: コミュニティの作成・編集をワーカーと同様にモーダルダイアログで操作できるようにする (#833)

## 1. 目的 / 背景

管理画面（`/admin?tab=communities`）のコミュニティ管理は、作成がタブ上部の常時表示インラインフォーム（`CreateCommunityForm`）、編集が一覧行内に展開するインラインフォーム（`EditCommunityForm`）という方式になっている。一方、ワーカー管理は作成・編集ともにモーダルダイアログ（`AddWorkerDialog` / `EditWorkerDialog`）方式である。

UI の一貫性を持たせるため、コミュニティ管理もワーカーと同じモーダル方式に統一する。

## 2. スコープ（やること / やらないこと）

### やること

- `AddCommunityDialog`（作成モーダル）を新規作成する。
- `EditCommunityDialog`（編集モーダル・画像アップロード含む）を新規作成する。
- `CommunitiesTab` をリファクタし、インライン `CreateCommunityForm` を「コミュニティを追加」ボタン + `AddCommunityDialog` に、`CommunityRow` のインライン編集を `EditCommunityDialog` に置き換える。
- インライン専用だった `CreateCommunityForm` / `EditCommunityForm` を削除する。
- 各ダイアログの RTL テストを TDD で追加する。
- `CommunitiesTab.test.tsx` を新しいモーダルフローに合わせて更新する。
- e2e ユースケース（`e2e/admin/usecases.md` UC-ADMIN-07/10/14）と該当 Playwright spec を新フローに合わせて更新する。

### やらないこと

- API（`/api/admin/communities` の作成・更新・画像アップロード）の変更。フックは既存（`useCreateCommunity` / `useUpdateCommunity` / `useUploadCommunityImage`）をそのまま利用する。
- `CommunityFormFields`（共通フィールド）・`CommunityImageUpload`（画像）の変更。両ダイアログから継続利用する。
- コミュニティ削除機能の追加。

## 3. 受け入れ条件（テストに落とせる粒度）

### AddCommunityDialog（`AddCommunityDialog.test.tsx`）

1. `open=true` でダイアログ（role=dialog）とタイトル「コミュニティを追加」が表示される。
2. `open=false` でダイアログは表示されない。
3. slug・コミュニティ名・コミュニティ概要（公開）・生成プロンプト指示の各入力欄が表示される。
4. 必須項目が空のまま送信すると「slug は必須です」「コミュニティ名は必須です」「作風の説明は必須です」が表示され、作成 API（POST /api/admin/communities）は呼ばれない。
5. slug が形式不正（例: `Invalid_Slug`）のとき形式エラーが表示され、作成 API は呼ばれない。
6. 有効な入力で送信すると作成 API が正しい body（slug/name/description/generationInstruction）で呼ばれ、`onClose` が呼ばれる。
7. 作成 API が 409 を返すと「この slug はすでに使用されています」が表示される。
8. キャンセルボタンで `onClose` が呼ばれる。
9. 各入力欄に Zod `.max()` と整合する `maxLength` が設定されている（slug/name/description/generationInstruction）。

### EditCommunityDialog（`EditCommunityDialog.test.tsx`）

10. `open=true` でダイアログとタイトル「コミュニティ編集」が表示される。
11. `open=false` でダイアログは表示されない。
12. 既存コミュニティの name・description・generationInstruction が初期値として表示される。
13. name を変更して保存すると更新 API（PATCH /api/admin/communities/:id）が変更後の body で呼ばれ、`onClose` が呼ばれる。
14. name を空にして送信すると「コミュニティ名は必須です」が表示され、更新 API は呼ばれない。
15. カバー画像・アイコン画像のアップロード UI（`CommunityImageUpload`）がダイアログ内に表示される。
16. 更新 API が失敗するとエラー（Snackbar/alert）が表示され、ダイアログは閉じない。
17. 各入力欄に Zod `.max()` と整合する `maxLength` が設定されている（name/description/generationInstruction）。

### CommunitiesTab（`CommunitiesTab.test.tsx` 更新）

18. 「コミュニティを追加」ボタンが表示され、クリックすると `AddCommunityDialog` が開く。
19. インライン作成フォーム（「新しいコミュニティを作成」見出し）は表示されない。
20. 一覧の「編集」ボタンをクリックすると `EditCommunityDialog` が開く（行内インライン展開ではない）。
21. 既存コミュニティ一覧（名前・slug）が表示される。

### 規約

22. フォーム状態は `@tanstack/react-form`（`useForm` + `form.Field`）で管理する（`useState` によるフィールド管理をしない）。
23. `client → common` の一方向 import 境界を維持する。
24. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

### AddCommunityDialog（`client/src/components/AddCommunityDialog.tsx`）

- props: `{ open: boolean; onClose: () => void; onCreated?: () => void }`。
- `AddWorkerDialog` と同じく `useForm`（defaultValues `{ slug, name, description, generationInstruction }`）。
- slug は `COMMUNITY_SLUG_REGEX` のバリデーション付き `form.Field` で個別描画（既存 `CreateCommunityForm` と同等）。name/description/generationInstruction は `CommunityFormFields` を継続利用。
- `useCreateCommunity` で作成。成功時 `form.reset()` → `onCreated?.()` → `onClose()`。
- エラー表示はダイアログ内 `Alert`。409 を含むメッセージのとき「この slug はすでに使用されています」に変換（既存 `CreateCommunityForm` のロジックを踏襲）。エラー表示は form フィールドではないため `useState` で保持してよい（CLAUDE.md フォーム規約はフィールド/ダーティの自前管理を禁止するもの）。

### EditCommunityDialog（`client/src/components/EditCommunityDialog.tsx`）

- props: `{ community: AdminCommunity; open: boolean; onClose: () => void }`。
- `EditWorkerDialog` と同じく `useForm`（defaultValues は community の現在値）。`CommunityFormFields` を継続利用。
- カバー・アイコンの `CommunityImageUpload` をダイアログ内に配置（既存 `EditCommunityForm` のレイアウトを踏襲）。画像アップロードはフォーム送信と独立した即時アップロード。
- `useUpdateCommunity` で更新。成功時 `onClose()`。失敗時は `EditWorkerDialog` 同様 `Snackbar` + `Alert`（`getApiErrorMessage`）でエラー表示し、ダイアログは閉じない。

### CommunitiesTab（`client/src/components/CommunitiesTab.tsx` リファクタ）

- `CreateCommunityForm` / `EditCommunityForm` を削除。
- タブ上部に「コミュニティを追加」ボタン（`AddWorkerButton` 相当）を置き、クリックで `AddCommunityDialog` を開く（`open` state）。作成成功時に成功 Snackbar「コミュニティを作成しました」を表示。
- `CommunityRow` は `editing` インライン state を廃止し、`dialogOpen` state で `EditCommunityDialog` を開閉する。行は常にデータ行を表示。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client** のみ（common/server/docs に変更なし）。
- 新規: `client/src/components/AddCommunityDialog.tsx` / `EditCommunityDialog.tsx` と各 `.test.tsx`。
- 変更: `client/src/components/CommunitiesTab.tsx`（インラインフォーム削除・ダイアログ化）/ `CommunitiesTab.test.tsx`（新フロー）。
- e2e: `e2e/admin/usecases.md`（UC-ADMIN-07/10/14）/ `e2e/admin/admin.spec.ts`（UC-ADMIN-10/14 のステップをモーダルフローへ）。

## 6. テスト計画（TDD で書くテスト一覧）

- `AddCommunityDialog.test.tsx`: 受け入れ条件 1〜9（MSW で API モック）。
- `EditCommunityDialog.test.tsx`: 受け入れ条件 10〜17（MSW で API モック）。
- `CommunitiesTab.test.tsx`（更新）: 受け入れ条件 18〜21。
- 既存 `CommunityFormFields.test.tsx` は変更なし（共通フィールドは不変）。

## 7. リスク・未決事項

- `CommunitiesTab.test.tsx` は既存のインライン前提テストを大きく書き換える必要がある（作成・編集の検証はダイアログ側の専用テストへ移す）。
- Playwright spec（UC-ADMIN-10/14）は `pnpm turbo run build test lint` には含まれない（`pnpm e2e` 系）が、`/release-check` の整合のため同 PR で更新する。
- 409 判定は既存同様メッセージ文字列に依存する暫定実装（API が機械可読なエラーコードを返さないため）。本 Issue ではスコープ外として現行踏襲。
