# Issue #501 設計書: フィード一覧では投稿本文を省略表示（line-clamp）

## 背景・目的

ホームフィード・コミュニティフィードの `PostCard` は post 本文を全文描画しており、長い投稿でフィードが間延びして一覧性が損なわれている。フィード一覧では本文を数行に省略（CSS line-clamp）し、スレッド詳細では従来どおり全文表示する。

`PostCard` は一覧（`HomeFeedScene` / `CommunityScene`）とスレッド詳細（`PostThreadScene`）で共用されているため、コンテキストごとに表示を切り替えるフラグを `PostCard` に持たせる。

## 受け入れ条件 → 入出力

1. `PostCard` に `truncateText?: boolean`（デフォルト `false`）を追加。有効時は本文 `Typography` に CSS line-clamp（3 行）スタイルを適用し、多段落でも 3 行で切る。
2. `HomeFeedScene` / `CommunityScene` では `truncateText` を有効に、`PostThreadScene` では無効（全文表示）にする。
3. `PostCard` の RTL テストに「省略フラグ有効時に line-clamp スタイルが適用される／無効時は全文表示される」ケースを追加する。
4. `pnpm turbo run build test lint` が緑。client → common の一方向 import 境界を破らない。

## 設計判断

- **省略の実現**: MUI `Typography` の `sx` に `display: "-webkit-box"`, `WebkitLineClamp: 3`, `WebkitBoxOrient: "vertical"`, `overflow: "hidden"` を渡す。新規依存・新規ユーティリティは不要。`uiParts` 経由の `Typography` をそのまま使い、コンポーネント縛り（#178）を守る。
- **行数**: 3 行（Issue 例示どおり）。本文の `Typography` に直接適用する。
- **テスト検証方法**: 本文の DOM 要素を取得し、`truncateText` 有効時に `WebkitLineClamp` 相当のスタイル（`-webkit-line-clamp: 3` / `display: -webkit-box`）が style 属性に出ていること、無効時は出ていないことを `toHaveStyle` で確認する。本文テキスト自体は両方とも DOM に存在する（CSS で視覚的に省略するだけ）。
- **スコープ外**: 「続きを読む」展開トグルは作らない（スレッドを開けば全文が読める）。

## 影響範囲

- `client/src/components/PostCard.tsx`（props 追加 + 本文 sx 分岐）
- `client/src/components/PostCard.test.tsx`（テスト追加）
- `client/src/routes/HomeFeedScene.tsx` / `CommunityScene.tsx`（`truncateText` 付与）
- `e2e/home-feed/usecases.md` / `e2e/community/usecases.md`（一覧で本文が省略表示されるユースケース追記）
