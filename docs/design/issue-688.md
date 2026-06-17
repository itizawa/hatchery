# Issue #688 設計書: PostCard コメント数アイコンを MUI アイコンに差し替える

## 背景・目的

`client/src/components/PostCard.tsx:167` でコメント数の表示に `💬` 絵文字を使用している。
同コンポーネント内の他のインタラクティブ要素（ShareButton 等）は MUI アイコンを使用しており、
絵文字はフォント・OS によって描画が異なるため、MUI アイコンコンポーネントに統一して UI の視覚的一貫性を確保する。

## 変更内容

### `client/src/components/PostCard.tsx`

- `<span aria-hidden="true">💬</span>` を `<ChatBubbleOutlineIcon fontSize="small" sx={{ color: "text.secondary", verticalAlign: "middle" }} aria-hidden="true" />` に差し替える
- `@mui/icons-material/ChatBubbleOutline` を import する
- 既存の `aria-label="コメント N 件"` は維持する

### `client/src/components/PostCard.test.tsx`

- テスト説明文の "💬" 表記を更新し、MUI アイコンへの差し替えを前提にした説明に変更する
- 実際のテストロジック（`aria-label` による要素取得、`textContent` 確認）は変更不要

## 受け入れ条件との対応

1. `💬` 絵文字 → `ChatBubbleOutlineIcon` への差し替え ✓
2. サイズ `fontSize="small"`・色 `color="text.secondary"`・縦揃え `verticalAlign: "middle"` で統一 ✓
3. `aria-label="コメント N 件"` 維持・`aria-hidden="true"` 適切設定 ✓
4. `pnpm turbo run build test lint` 全て緑 ✓（実装後確認）

## 設計判断

- アイコンは `ChatBubbleOutlineIcon`（`@mui/icons-material/ChatBubbleOutline`）を採用。ShareButton で使用している MUI アイコンのパターンに倣う。
- サイズは `fontSize="small"` とし、周辺の `body2` テキストと高さを揃える。
- `sx={{ verticalAlign: "middle" }}` で縦揃えを明示し、テキストとの位置ずれを防ぐ。
- スコープは `PostCard.tsx` のみ（他画面の対応は別 Issue 担当）。
