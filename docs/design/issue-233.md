# 設計書: サイドバーに「チャンネル」セクション追加・チャンネル作成をプラスアイコン＋ツールチップで表示 (#233)

## 1. 目的 / 背景

現在のサイドバーはチャンネル一覧がセクションヘッダーなしで並び、チャンネル作成はインラインフォームとして常時表示されている。
Reddit 風の UI に改善し、「チャンネル」セクションヘッダーとプラスアイコン（ツールチップ付き）でチャンネル作成を行えるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- サイドバーに「チャンネル」セクションヘッダーを追加
- セクションヘッダー右端にプラスアイコン（IconButton）を配置
- プラスアイコンにツールチップ「チャンネルを追加」を表示
- プラスアイコンクリックでチャンネル作成ダイアログを開く
- 未ログイン時はプラスアイコンを非表示
- インライン `AddChannelForm` を削除し `CreateChannelDialog` に置き換え

### やらないこと
- チャンネルリストのソート・フィルタリング
- チャンネルタイプの新種追加
- プラスアイコン以外のチャンネル作成動線

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. サイドバーに「チャンネル」というテキストが表示される
2. ログイン時、「チャンネルを追加」ツールチップ付きのプラスアイコンが表示される
3. 未ログイン時、プラスアイコンは表示されない
4. プラスアイコンをクリックするとチャンネル作成ダイアログが開く
5. ダイアログ内にチャンネル名入力欄とタイプ選択（雑談・仕事）がある
6. ダイアログで送信するとチャンネルが作成される（POST /api/channels）
7. ダイアログのキャンセルボタンでダイアログが閉じる
8. 既存のチャンネル一覧（GET /channels 駆動）は変化なし

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 新コンポーネント

#### `SidebarChannelSection`
- セクションヘッダー「チャンネル」（Typography）＋プラスアイコン（Tooltip + IconButton）を横並び（Box flex）で表示
- `useAuth()` で認証状態を判定し、ログイン時のみプラスアイコンを表示
- ダイアログ open/close state を管理（useState）
- `ChannelList`（Suspense 内）と `CreateChannelDialog` を子に持つ

#### `CreateChannelDialog`
- Props: `open: boolean`, `onClose: () => void`
- MUI `Dialog` + `DialogTitle` + `DialogContent` + `DialogActions`
- チャンネル名入力（TextField）とタイプ選択（RadioGroup）を持つ
- `useAuth()` でユーザーチェック（管理者 or 一般ユーザー問わずログイン済みなら作成可）
- `useCreateChannel()` で POST /api/channels
- 送信成功後：フォームクリア＋ダイアログクローズ

### 変更するコンポーネント

- `RootLayout.tsx`: `<Suspense><ChannelList/></Suspense>` と `<AddChannelForm/>` を `<SidebarChannelSection/>` に差し替え
- `AddChannelForm.tsx` / `AddChannelForm.test.tsx`: 削除（CreateChannelDialog に統合）
- `uiParts/index.ts`: `Tooltip`, `IconButton`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` を追加

### MUI アイコン
- `@mui/icons-material/Add` を使用（`AddIcon` として import）

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `client/src/components/AddChannelForm.tsx` | 削除 |
| `client/src/components/AddChannelForm.test.tsx` | 削除 |
| `client/src/components/uiParts/index.ts` | Tooltip, IconButton, Dialog 系を追加 |
| `client/src/routes/RootLayout.tsx` | SidebarChannelSection に差し替え |
| `client/src/components/ChannelList.tsx` | 変更なし |
| `client/src/components/ChannelList.test.tsx` | 変更なし |

## 6. テスト計画（TDD で書くテスト一覧）

### `SidebarChannelSection.test.tsx`（新規）
1. 「チャンネル」セクションヘッダーが表示される
2. ログイン時はプラスアイコンが表示される
3. 未ログイン時はプラスアイコンが表示されない
4. プラスアイコンクリックで CreateChannelDialog が開く

### `CreateChannelDialog.test.tsx`（新規）
1. `open=true` のとき、ダイアログタイトルとフォームが表示される
2. `open=false` のとき、ダイアログは非表示
3. チャンネル名入力で Submit ボタンが有効化される
4. 送信すると POST /api/channels が呼ばれる
5. キャンセルボタンで `onClose` が呼ばれる

## 7. リスク・未決事項

- `@mui/icons-material` が client に既にインストールされているか確認が必要
- `useAuth()` は `useQuery`（非 Suspense）なので `SidebarChannelSection` は Suspense 境界の外でも動作する
