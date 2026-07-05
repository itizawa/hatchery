# 設計書: コミュニティ詳細の投稿並べ替えをボタン+メニュー形式のUIに変更する (#1062)

## 1. 目的 / 背景

`client/src/routes/CommunityScene.tsx`（`CommunityContent` 内）のコミュニティ詳細フィードの並べ替え UI は現在 MUI `Tabs`/`Tab`（「新着」「人気」の2択）として実装されている。ユーザー要望により、Reddit のように「ボタンをクリックするとメニューが開き、その中から並び順を選ぶ」形式に変更する。バックエンドの並べ替えロジック（`sort` state・API パラメータ・`CommunityFeedSortSchema`）には手を入れない、**見た目のみの置き換え**。

## 2. スコープ（やること / やらないこと）

### やること

- `Tabs`/`Tab` を、選択中の並び順ラベルを表示するボタン（開閉矢印アイコン付き）+ `Menu`/`MenuItem` に置き換える。
- ボタンに「並べ替えオプションを開く」ツールチップを付与する。
- メニュー内で選択中の並び順に選択状態（チェックマーク）を表示する。
- 既存の `sort` state・`useInfiniteCommunityFeed` への伝搬・API パラメータ挙動は変更しない。
- 既存の関連テスト（`CommunityScene.test.tsx` の `#886` タブ関連テスト）を新 UI に合わせて更新する。
- `e2e/community/usecases.md` の `UC-COMM-29` を新 UI の操作手順に更新する。

### やらないこと

- 「賛成票率順」等、新しい並べ替えロジックの追加（`CommunityFeedSortSchema` 拡張・サーバ側ソート実装）は別 Issue。
- API パラメータ名 (`sort`)・`communityFeedQueryKey` の変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 並べ替え UI がボタン（現在選択中の並び順ラベル + 開閉を示す下向き矢印アイコン）として表示される。
2. ボタンをクリックするとメニューが開き、「新着」「人気」の2項目が表示される。
3. ボタンには `aria-haspopup="true"` / `aria-expanded` / `aria-controls` が付与される。
4. ボタンに「並べ替えオプションを開く」というツールチップ（ホバーで表示）が付与されている。
5. メニュー項目をクリックすると `sort` state が更新され、ボタンのラベルが選択した並び順に変わり、メニューが閉じる。
6. `sort` 変更に応じて `useInfiniteCommunityFeed` への `sort` 引き渡し・フィード再取得が既存 `Tabs` 実装と同じ挙動で動作する（`sort=popular` の再取得、`latest`/`popular` 独立キャッシュ）。
7. メニューを開いた状態で現在選択中の項目にチェックマーク（`CheckRounded` アイコン）が表示される。
8. アイコンは Rounded バリアント（`ArrowDropDownRounded` / `CheckRounded`）を使用する（CLAUDE.md アイコン規約）。
9. デザインシステム規約（角丸16px以上不使用・アクセントカラーはボタン/選択チェックのみ等）に反する UI にしない。
10. `pnpm --filter @hatchery/client test` と `pnpm --filter @hatchery/client lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 変更は `client/src/routes/CommunityScene.tsx` の `CommunityContent` 内のみ（既存の `sort` state / `handleSortChange` ロジックは温存しつつ、`Tabs` の代わりに新規ローカルコンポーネント `SortMenuButton` を同ファイル内に追加する。追加ファイルは作らない — 単一の置き換えでコンポーネント分割の必要性は薄い）。
- 開閉状態は `useState<HTMLElement | null>` の `anchorEl`（`AppHeader.tsx` の `AppHeaderAuthSection` と同じパターン）。
- Menu 実装は `client/src/components/uiParts/Menu.ts`（`Menu`/`MenuItem`）+ `ButtonBase` + `aria-haspopup`/`aria-expanded`/`aria-controls`（`AppHeader.tsx` 104-144行目のパターンを踏襲）。
- ボタンラベル: `SORT_LABELS: Record<CommunityFeedSort, string> = { latest: "新着", popular: "人気" }` のマップから `sort` state を引いて表示。
- ツールチップ: `uiParts` の共有 `Tooltip` で `ButtonBase` をラップ。
- 選択中アイテムのチェックマーク: `ListItemIcon` + `@mui/icons-material/CheckRounded`（未選択時は `ListItemIcon` を非表示にせず空にして幅を揃える）。
- 開閉矢印アイコン: `@mui/icons-material/ArrowDropDownRounded`。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `client`: `client/src/routes/CommunityScene.tsx`（UI 置き換え）、`client/src/routes/CommunityScene.test.tsx`（既存 `#886` タブテストの更新 + メニュー版アサーションへの置き換え）。
- `common` / `server`: 変更なし（`sort` state・API パラメータは維持）。
- `e2e/community/usecases.md`: `UC-COMM-29` の操作手順・期待動作をメニュー UI に更新。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/routes/CommunityScene.test.tsx` を以下のように更新する（TDD: 先にテストを更新 → 失敗確認 → 実装）:

1. 「並べ替えボタンに現在の並び順（初期値『新着』）がラベル表示される」
2. 「並べ替えボタンをクリックするとメニューが開き『新着』『人気』の2項目が表示される」
3. 「並べ替えボタンに `aria-haspopup`/`aria-expanded`/`aria-controls` が設定される」
4. 「並べ替えボタンに『並べ替えオプションを開く』ツールチップが設定される」
5. 「メニューで『人気』を選択するとボタンラベルが『人気』に変わり、フィードが再取得される（既存 #886 の切替テストを踏襲）」
6. 「メニューを開いた状態で現在選択中の項目（初期値『新着』）にチェックマークが表示される」

既存の `it("「新着」「人気」タブが表示される（#886）")` 等 3 件のテスト（`role: "tab"` ベース）は上記メニュー版アサーションに置き換える（Tabs 自体を廃止するため）。

## 7. リスク・未決事項

- 既存テストの `role: "tab"` セレクタは新 UI では該当要素が無くなるため、置き換えが必要（そのままでは失敗する）。今回は置き換えとして扱う（TDD の「まずテストを書く」は、この Issue のスコープでは「既存タブテストをメニュー版に更新する」ことを含む）。
- 未決事項なし（スコープはボタン+メニュー化のみに限定）。
