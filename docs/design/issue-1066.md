# 設計書: 新着ポストサイドバーカードの各投稿アイテムを角丸・薄いグレー背景のスタイルに変更する (#1066)

## 1. 目的 / 背景

`client/src/components/RecentPostsSidebarCard.tsx`（ホームフィード右サイドバーの「新着ポスト」カード、#928 で追加）は現在、各投稿アイテム（`Box component="li"`）を素のリスト項目として表示しており、外枠（`sidebarCardSx.ts` の `sidebarCardOuterBoxSx`）以外に背景色や角丸の装飾がない。ユーザー要望により、各投稿アイテムを「丸みを帯びた・背景色の薄いgrey」のカード状スタイルに変更する。参照画像にあるサムネイル表示・「クリア」（閲覧履歴クリア）機能は、対応するデータ・機能が存在しないためスコープ外とする。

## 2. スコープ（やること / やらないこと）

### やること

- 各投稿アイテム（`Box component="li"`）に薄いグレー背景・角丸（16px 未満）・調整済み padding の `sx` を追加する。
- 背景色は `SLACK_COLORS.mainBackground`（`#F6F7F8`）を再利用する（新規トークンは追加しない。カード外枠が白系サイドバー上にあるため、既存のメイン背景色を流用してもコントラストが成立する）。
- 既存の hover 挙動・タイトル2行クランプ・本文1行クランプ・コミュニティ名/投稿時刻レイアウトを維持する。
- `RecentPostsSidebarCard.test.tsx` にスタイル検証テストを追加する。

### やらないこと

- サムネイル画像表示機能・「クリア」（閲覧履歴クリア）機能の追加（データモデルに対応フィールドがなく、スコープ外）。
- カード外枠（`sidebarCardOuterBoxSx`）・見出し・`Divider` の変更。
- `SLACK_COLORS` への新規カラートークン追加（既存 `mainBackground` の再利用で要件を満たせるため）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 各投稿アイテム（`li`）に薄いグレー背景色（`SLACK_COLORS.mainBackground`）が設定される。
2. 各投稿アイテムの角丸が 16px 未満（本実装では 8px）で設定される。
3. 各投稿アイテムに padding が設定され、既存のタイトル2行クランプ・本文1行クランプ・レイアウトが崩れない。
4. 既存の hover 挙動（タイトルが `primary.main` に色変化）が維持される。
5. カードの外枠・見出し・`Divider` は変更されない。
6. コンポーネント側に16進カラーをハードコードせず `SLACK_COLORS` 経由で指定する。
7. `pnpm --filter @hatchery/client test` と `pnpm --filter @hatchery/client lint` が緑であること。
8. 見た目のみの変更でクリック導線・遷移先などユーザー可視の振る舞いは変わらないため、`e2e/` usecases の更新は不要（PR にその旨を明記する）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `RecentPostsSidebarCard.tsx` の `Box component="li"` に `sx` を追加: `backgroundColor: SLACK_COLORS.mainBackground`, `borderRadius: 2`（MUI `shape.borderRadius` 既定値 4px × 2 = 8px、16px 未満）, `p: 1.5`（12px）。
- `SLACK_COLORS` は `../theme.js` から import する（他コンポーネントの既存 import パターンに合わせる）。
- 既存の `ul` 側 `gap: 1.5` はそのまま維持し、カード化した各アイテム間の視覚的区切りとして機能させる。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- `client`: `client/src/components/RecentPostsSidebarCard.tsx`（スタイル追加）、`client/src/components/RecentPostsSidebarCard.test.tsx`（スタイル検証テスト追加）。
- `common` / `server`: 変更なし。
- `e2e/`: 見た目のみの変更でユーザー可視の振る舞い（クリック導線・遷移先等）は変わらないため更新不要。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/components/RecentPostsSidebarCard.test.tsx` に以下を追加する:

1. 「各投稿アイテムに薄いグレー背景色（`SLACK_COLORS.mainBackground`）が設定される」
2. 「各投稿アイテムの角丸が 16px 未満で設定される」

## 7. リスク・未決事項

- 特になし。既存コンポーネントへの見た目調整のみで、API・データモデルへの影響はない。
