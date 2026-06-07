# 設計書: チャンネル名を詳細画面ヘッダとサイドバーの編集モーダルから変更できるようにする (#206)

## 1. 目的 / 背景

チャンネル名（`Channel.label`）を UI から変更する導線がなかった。バックエンドの `PATCH /channels/{id}` は実装済みで、`openapi.gen.ts` にも型が生成済みのため、client 側のみの変更で対応できる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `useUpdateChannel` ミューテーションフックの追加（`client/src/api/channels.ts`）
- 再利用可能な `EditChannelNameDialog` コンポーネントの新規追加
- `ChannelView` ヘッダに編集ボタンを追加（ログイン時のみ、onEditName prop 経由）
- `ChannelScene` が編集ダイアログを制御（コンテナ責務）
- `ChannelList` サイドバーに hover 時 3 点メニューを追加（ログイン時のみ）

**やらないこと:**
- server / common の変更（バックエンドは実装済み）
- チャンネルタイプの変更
- チャンネル削除
- 楽観的更新（invalidate ベースで対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useUpdateChannel` が `{ id, label }` を受け取り `PATCH /channels/{id}` を呼び、成功時に `CHANNELS_QUERY_KEY` を invalidate する
2. `EditChannelNameDialog` の `inputProps.maxLength` が `CHANNEL_LABEL_MAX_LENGTH`（50）と等しい
3. trim 後空文字では保存ボタンが disabled
4. 保存成功で `onClose` が呼ばれる（モーダルが閉じる）
5. 保存で正しい id・label で PATCH エンドポイントが呼ばれる
6. `ChannelView` は `onEditName` prop が渡されると編集ボタンを表示し、渡されないと表示しない
7. `ChannelList` はログイン時に 3 点メニューボタンを表示し、未ログイン時は表示しない
8. 3 点メニューをクリックすると「名前を編集」メニュー項目が表示され、クリックで編集ダイアログが開く

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**コンポーネント責務の分離:**
- `EditChannelNameDialog` — 純粋な編集モーダル。`open/channel/onClose` props で制御。内部で `useUpdateChannel` を呼ぶ。
- `ChannelView` — presentational を維持。`onEditName?: () => void` を追加。認証状態は props 経由で受け取る。
- `ChannelScene` — コンテナ。`useAuth` でログイン確認し `onEditName` を渡す。`EditChannelNameDialog` の open/close state を保持。
- `ChannelList` — `useAuth` でログイン確認し、3 点メニュー + `EditChannelNameDialog` を管理。

**import 境界:** client → common の一方向のみ。`@mui/material/*` は `uiParts` 経由。`@mui/icons-material` は直接 import 可（ESLint 制約対象外）。

**バリデーション二重防御:** `inputProps.maxLength = CHANNEL_LABEL_MAX_LENGTH`（server 側 Zod `.max(50)` と同値）。

## 5. 影響範囲 / 既存への変更

**変更ファイル:**
- `client/src/api/channels.ts` — `useUpdateChannel` を追加
- `client/src/components/ChannelView.tsx` — `onEditName` prop 追加、編集ボタン追加
- `client/src/components/ChannelList.tsx` — `useAuth` import、3 点メニュー + ダイアログ追加
- `client/src/routes/ChannelScene.tsx` — `EditChannelNameDialog` の state 管理追加

**新規ファイル:**
- `client/src/components/EditChannelNameDialog.tsx`
- `client/src/components/EditChannelNameDialog.test.tsx`

**テスト更新:**
- `client/src/components/ChannelView.test.tsx` — `onEditName` 関連テスト追加
- `client/src/components/ChannelList.test.tsx` — 3 点メニュー関連テスト追加

## 6. テスト計画（TDD で書くテスト一覧）

### EditChannelNameDialog.test.tsx（新規）
- 初期値にチャンネル名が入っている
- maxLength = CHANNEL_LABEL_MAX_LENGTH
- 空白のみで保存ボタンが disabled
- 保存で PATCH /channels/{id} が正しい引数で呼ばれる
- 保存成功で onClose が呼ばれる

### ChannelView.test.tsx（追加）
- `onEditName` が渡されると編集ボタンが表示される
- `onEditName` が渡されないと編集ボタンが非表示（未ログイン相当）
- 編集ボタンクリックで `onEditName` が呼ばれる

### ChannelList.test.tsx（追加）
- 未ログイン時は 3 点メニューボタンが表示されない
- ログイン時は 3 点メニューボタンが表示される
- 3 点ボタンクリックでメニューが開き「名前を編集」が表示される
- 「名前を編集」クリックで編集ダイアログが開く

## 7. リスク・未決事項

- hover 時のみボタン表示は CSS で実装（MUI の `sx` の `:hover` セレクタ）。テストでは CSS 表示状態でなく DOM 存在を検証する。
- `EditChannelNameDialog` は `open` 変化時に `label` state をリセットする（`useEffect` で同期）。
