# 設計書: ヘッダー検索欄を画面中央に配置し、検索結果画面から重複する見出し・入力欄を削除する (#1112)

## 1. 目的 / 背景

`AppHeader`（`client/src/components/AppHeader.tsx`）のヘッダー検索欄（#1055）は、ロゴと右端スロットに挟まれた flex レイアウトで `flex: 1` により伸縮しているため、ロゴ幅と右端スロット幅が非対称な現状では見た目上ヘッダー中央に来ていない。

一方、検索結果画面 `SearchScene.tsx` には見出し「投稿を検索」とヘッダーと同機能の検索フォーム・入力欄が独立して存在する。これは #1055 の設計書（`docs/design/issue-1055.md` の「やらないこと」）で意図的に残す方針として明記されていたが、ヘッダー検索欄が全ページ常設になった今、画面内での重複表示は情報密度を下げる。

## 2. スコープ（やること / やらないこと）

**やること**

- `AppHeader` を「左（メニュー＋ロゴ）／中央（検索欄）／右（インストールボタン＋アカウント領域）」の3領域構造にし、中央領域を左右領域の幅に関わらず水平方向中央に配置する。
- 3領域に `data-testid`（`header-left-slot` / `header-center-slot` / `header-right-slot`）を付与する。
- `SearchScene.tsx` から見出し「投稿を検索」と検索フォーム・入力欄を削除し、検索結果一覧のみを表示する画面にする。
- `SearchScene.tsx` の `useSearchQueryForm` 呼び出し・関連 import を削除する。
- `e2e/search/usecases.md` の `UC-SEARCH-04`（ページ内検索フォームからの検索）を、ページ内フォームが存在しない前提に更新する。

**やらないこと**

- `AppHeader.tsx` 側の `useSearchQueryForm({ preserveUnsyncedEdits: true })` の呼び出し・同期ロジックの変更。
- モバイル幅での中央配置の見え方の専用テスト追加。
- 投稿以外（コミュニティ・ワーカー等）の横断検索への拡張。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `AppHeader` が `display: grid` の3領域（左/中央/右）構造になり、中央領域が左右領域の幅に関わらず水平中央に配置される。
2. `header-left-slot` / `header-center-slot` / `header-right-slot` の3つの `data-testid` が存在し、`header-center-slot` の中に検索用 `textbox`（`aria-label="投稿を検索"`）が含まれる。
3. 既存の `AppHeader.test.tsx` のヘッダー検索欄関連テスト（表示・Enter 送信での遷移・空欄送信・`/search?q=foo` 時の初期値反映・ヘッダー高さ固定#485系）がすべて引き続き通る。
4. `SearchScene.tsx` に見出し `Typography`「投稿を検索」が存在しない。
5. `SearchScene.tsx` に検索フォーム・`TextField` 入力欄（プレースホルダー「キーワードを入力...」）が存在しない。
6. `SearchScene.tsx` は検索結果一覧（`SearchResults`）のみを表示し、クエリなし／読込中／エラー／0件時の案内表示は現状のまま維持する。
7. `SearchScene.test.tsx` が新しい画面構成（見出し・入力欄なし、結果表示のみ）に合わせて更新されている。
8. `e2e/search/usecases.md` の `UC-SEARCH-04` がページ内フォームなし前提に更新されている。
9. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `AppHeader.tsx` のルート `Box` を `display: "flex"` から `display: "grid", gridTemplateColumns: "1fr minmax(0, 480px) 1fr"` に変更する。中央トラックを `minmax(0, 480px)` で明示的に上限を持たせることで、左右トラック（`1fr`）の内容量が非対称でも中央トラックが常に真の水平中央に来る（`1fr` 側は余剰スペースを均等に吸収するため）。
- 左領域 (`header-left-slot`): メニュー `IconButton`（`onMenuOpen` 指定時のみ）＋ロゴ `Link` を横並びで配置。
- 中央領域 (`header-center-slot`): 既存の `HeaderSearchField` をそのまま内包。`HeaderSearchField` 側の `flex: 1` は不要になるため `width: "100%"` に変更する。
- 右領域 (`header-right-slot`): インストール `IconButton`（`showInstallButton` 時のみ）＋ `QueryBoundary`/`AppHeaderAuthSection` を横並びで配置し、`height: RIGHT_SLOT_HEIGHT` を維持して既存の #485 高さ固定テストを壊さない。
- `SearchScene.tsx` は検索フォーム部分（見出し・`TextField`・`useSearchQueryForm` 呼び出し）を削除し、`SearchResults` の描画のみ残す。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / docs）

- `client/src/components/AppHeader.tsx`: レイアウトをグリッド3領域構造に変更。
- `client/src/components/AppHeader.test.tsx`: 中央配置構造の新規テストを追加。
- `client/src/routes/SearchScene.tsx`: 見出し・検索フォームを削除。
- `client/src/routes/SearchScene.test.tsx`: 新しい画面構成に合わせて更新（フォーム同期テストを削除、見出し・入力欄が存在しないことのテストを追加）。
- `e2e/search/usecases.md`: `UC-SEARCH-04` を更新。

## 6. テスト計画（TDD で書くテスト一覧）

`AppHeader.test.tsx` に追加:

- `header-left-slot` / `header-center-slot` / `header-right-slot` の3つの `data-testid` が存在する。
- `header-center-slot` の中に検索用 `textbox`（`aria-label="投稿を検索"`）が含まれる。
- ヘッダーのルート要素が `display: grid` である。

`SearchScene.test.tsx` の変更:

- （削除）「未送信の編集中に q が変わる...リセットされる」テスト（ページ内フォームが無くなるため対象外）。
- （追加）見出し「投稿を検索」が表示されない。
- （追加）プレースホルダー「キーワードを入力...」の入力欄が表示されない。
- （維持）`my_vote: 'up'` の投稿の up vote 済み表示テスト。

## 7. リスク・未決事項

- 中央トラックの上限 480px は #1055 設計書の `HeaderSearchField` の既存 `maxWidth: 480` を踏襲した値であり、新たなデザイン判断ではない。
- インストールボタンを右領域の固定高さ (`RIGHT_SLOT_HEIGHT` = 40px) 内に配置すると、ボタン自体の既定サイズ（MUI `IconButton` medium 相当）が 40px を超える場合があるが、これは既存の高さ固定テスト（`toHaveStyle({height: "40px"})`）がコンテナの CSS 宣言値のみを検証するため、テスト上の問題にはならない。視覚的な見え方の微調整は別 Issue のスコープとする。
