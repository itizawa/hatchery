# Issue #780 設計書

## 概要

`PostThreadScene` の `CommunityBreadcrumb` コンポーネントに以下の改修を行う。

1. 「ポスト一覧」テキストの左に左向き矢印アイコン（`ChevronLeft`）を表示する
2. アンカーリンクがクリック時に赤くなる問題を修正する（UA デフォルト色を上書き）

## 変更対象

- `client/src/routes/PostThreadScene.tsx`（`CommunityBreadcrumb` コンポーネント）
- `client/src/routes/PostThreadScene.test.tsx`（テスト追加）

## 受け入れ条件（実装観点）

1. `ChevronLeft`（`@mui/icons-material`）をアイコンとして採用
2. アイコンとテキストを `Box sx={{ display: 'flex', alignItems: 'center' }}` で横並び中央揃え
3. `RouterLink` に `sx` プロパティを追加し、`color: "text.secondary"` + `"&:hover, &:active, &:visited": { color: "text.secondary" }` で全状態を上書き
4. リンク先は `/communities/$slug` を維持
5. アイコンは `fontSize="small"` 相当で `body2` テキストに視覚的に揃える

## 設計判断

### アイコン選択

`ChevronLeft` を選択した理由:
- `<` 形の小型矢印で「戻る」の意味が直感的
- MUI の `body2` フォントサイズ（14px）と `fontSize="small"`（20px）がバランス良く揃う

### スタイリング方針

MUI の `RouterLink`（`@tanstack/react-router` の `Link`）は生の `<a>` 要素として描画される。
MUI テーマに `a` タグのカラー上書きが無いため、UA デフォルトの青（未訪問）・赤（クリック中）・紫（訪問済み）が出てしまう。

`RouterLink` に直接 `sx` プロパティを渡すことで CSS-in-JS によるスタイル適用が可能。
`textDecoration: "none"` と全疑似クラス（`:hover, :active, :visited`）の `color` を明示的に `text.secondary` に固定する。

## テスト方針（TDD）

既存テスト（`#525 / #693`）を拡張する形で以下を追加:

1. パンくずリンクに `ChevronLeft` アイコン（`svg`）が含まれていることを確認
2. リンク href が `/communities/$slug` のままであることを確認（既存テストで担保済み）
3. `RouterLink` に `color: text.secondary` 相当のインラインスタイル／クラスが適用されていることを確認

なお、`:active` 等の疑似クラスの色は RTL では検証困難（CSS が適用されない環境）なため、
`sx` プロパティ経由でスタイル文字列が生成されること、および `data-testid` またはアクセシビリティ属性での確認にとどめる。

## TDD の流れ

1. テストに「パンくずリンク内に svg アイコンが存在する」「リンクに color スタイルが text.secondary 相当で適用される」を追加 → 失敗を確認してコミット
2. `CommunityBreadcrumb` に `ChevronLeft` + `sx` スタイルを追加して実装 → テスト緑 → コミット
3. `pnpm turbo run build test lint` で全体確認
