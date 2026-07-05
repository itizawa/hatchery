# 設計書: fix: 一覧画面のPost本文3行省略がMarkdownの複数ブロック要素に効いていない (#1105)

## 1. 目的 / 背景

一覧画面（`HomeFeedScene`・`SearchScene`・`CommunityScene`・`WorkerScene`）は `PostCard`（`truncateText=true`）経由で Post 本文を 3 行相当に省略表示する（#501）。

現状の実装（`MarkdownContent.tsx` L52–58）は line-clamp 用スタイル（`paragraphSx`）を `p`（段落）レンダラーにのみ注入している。`-webkit-line-clamp` は単一のブロック要素内でしか行数を数えられず、兄弟関係にある複数のブロック要素をまたいで省略できない。そのため見出し・複数段落・リスト・コードブロック・引用・テーブルを含む Markdown 本文は、`p` 以外のブロックがクランプされずそのまま描画され、一覧のカードが 3 行を大きく超えて縦に伸びる。

## 2. スコープ（やること / やらないこと）

### やること
- `MarkdownContent` の line-clamp 適用対象を `p` 個別から「レンダリング結果全体を包む外側コンテナ」に変更する。
- `PostCard` からの呼び出しを新しい API に合わせて変更する。
- 詳細画面（`PostThreadScene` 経由、クランプなし）の全文表示は変更しない。
- 単体テストを追加する（`MarkdownContent` / `PostCard`）。

### やらないこと
- 「続きを読む」等の展開 UI の新規追加（現行動作を変えない範囲での省略手段の修正に限定）。
- `p` レンダラー自体のマージン等スタイルの見直し（クランプ以外の変更はしない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `MarkdownContent` に `clampToLines?: number` prop を追加し、指定時は `ReactMarkdown` の出力全体を `display: "-webkit-box", WebkitLineClamp: clampToLines, WebkitBoxOrient: "vertical", overflow: "hidden"` を持つ `Box` でラップする。未指定時は Box でラップせず現行どおり全文表示する。
2. `PostCard` は `truncateText` が true のとき `MarkdownContent` に `clampToLines={3}` を渡し、false/未指定のときは渡さない（`paragraphSx` prop 経由の注入は廃止）。
3. 見出し・複数段落・箇条書きリスト・コードブロック・引用・テーブルのいずれかを含む Markdown 本文を `clampToLines` 指定でレンダリングしたとき、外側コンテナに line-clamp スタイルが適用されること（= 個々のブロック要素ではなく全体で高さがクランプされる）。
4. `clampToLines` 未指定（`PostThreadScene` 相当）では外側コンテナが line-clamp スタイルを持たず、既存の全文表示テストが変わらず通ること。
5. `pnpm turbo run build test lint` が緑であること。client → common の一方向 import 境界に違反しないこと。

## 4. 設計方針

- `MarkdownContent` のシグネチャを `paragraphSx?: Record<string, unknown>` から `clampToLines?: number` に置き換える。`p` レンダラーは常に固定の `{ mb: 0.5, mt: 0 }` を使う（クランプ由来のスタイル注入を撤去）。
- `ReactMarkdown` の呼び出し結果を変数に保持し、`clampToLines` が指定されているときだけ `Box` でラップして返す。未指定時は `ReactMarkdown` をそのまま返す（詳細画面の DOM 構造を変えない）。
- `PostCard.tsx` の呼び出し箇所を `paragraphSx={truncateText ? {...} : undefined}` → `clampToLines={truncateText ? 3 : undefined}` に変更する。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `client` のみ（`common` / `server` への変更なし）。
- 変更ファイル: `client/src/components/MarkdownContent.tsx`、`client/src/components/PostCard.tsx`。
- `CommentCard.tsx` は `paragraphSx` を使っていないため影響なし。

## 6. テスト計画

- `MarkdownContent.test.tsx`: `clampToLines` 指定時に見出し+リストの複数ブロックを含む本文で外側コンテナが line-clamp を持つこと／個別のブロック要素自体は持たないこと。未指定時は外側コンテナ自体が追加されないこと。
- `PostCard.test.tsx`: 既存の「truncateText 有効時は本文に line-clamp スタイルが適用される」を、`p` 個別ではなく外側コンテナに適用される検証へ更新。複数ブロック要素（見出し+リスト）を含む本文でも外側コンテナがクランプされることを追加検証。「truncateText 無効時」は変更なしで通ることを確認。

## 7. リスク・未決事項

- 既存の `PostCard.test.tsx` の「truncateText 有効時」テストは `p` 要素個別にクランプスタイルがあることを前提にしており、本修正で意図的に仕様を変更するため合わせて更新する（バグを固定化していた旧テストの是正）。
