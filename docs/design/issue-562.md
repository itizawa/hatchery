# 設計書: PostCard のタイトルと本文のフォントサイズに差をつけて視認性を改善する (#562)

## 1. 目的 / 背景

`PostCard` のタイトル（`variant="subtitle1"`）と本文（`variant="body1"`）が同一の 1rem でフォントサイズに差がなく、投稿一覧のヒエラルキーが読み取りにくい。タイトルを `h6`（1.25rem）、本文を `body2`（0.875rem）に変更してサイズ差を確立する。

## 2. スコープ（やること / やらないこと）

やること:
- `client/src/components/PostCard.tsx` のタイトル `Typography` を `variant="subtitle1"` → `variant="h6"` に変更
- `client/src/components/PostCard.tsx` の `MarkdownContent` を `variant="body1"` → `variant="body2"` に変更

やらないこと:
- テーマレベルのタイポグラフィカスタマイズ
- `PostThreadScene` のスレッド詳細ページの調整
- 他コンポーネントのタイポグラフィ整理

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `PostCard.tsx` の `Typography` タイトル要素に `variant="h6"` が設定されていること
- `PostCard.tsx` の `MarkdownContent` に `variant="body2"` が渡されていること
- タイトルが本文より明確に大きく表示される（h6=1.25rem > body2=0.875rem）
- 既存の `PostCard.test.tsx` 全テストが緑のまま
- `pnpm turbo run build test lint` が緑

## 4. 設計方針

`PostCard.tsx` の 2 箇所のみ変更。タイトルは `component="h3"` を維持（DOM 構造は変えない）し、視覚的な `variant` だけ `h6` に変更。本文は `MarkdownContent` の `variant` prop を `body2` に変更。

- `variant` 変更はクラス名が変わるのみで、テキストコンテンツ・DOM 構造は不変
- 既存テストはすべて text content / role / style で検証しており、MUI class 名には依存しないため追加テスト不要

## 5. 影響範囲 / 既存への変更

対象ワークスペース: `client/` のみ  
変更ファイル: `client/src/components/PostCard.tsx`（2 行）

## 6. テスト計画

既存の `client/src/components/PostCard.test.tsx` がすべて通ること（回帰確認）。追加テスト不要（テキストコンテンツに変化なし）。

## 7. リスク・未決事項

なし。2 行の variant 変更のみ。
