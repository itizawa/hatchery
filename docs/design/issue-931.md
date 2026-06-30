# 設計書: ネストコメントに返信元の一行プレビューを表示し会話の文脈を把握しやすくする (#931)

## 1. 目的 / 背景

`parent_comment_id` を持つ返信コメントに、親コメントのテキスト冒頭を引用プレビューとして表示する。
2 階層以上のネストでも「誰が何を受けて返したか」を一目で把握できるようにし、観察体験の質を上げる。

## 2. スコープ（やること / やらないこと）

**やること**:
- `CommentCard.tsx` に `parentComment?: Comment | null` prop を追加し、引用プレビュー UI を実装
- `PostThreadScene.tsx` の `renderCommentTree` から `commentMap` で親コメントを引き当てて渡す
- 引用テキストをクリックすると `#comment-${parentComment.id}` へスムーズスクロール
- `e2e/post-thread/usecases.md` に UC-POST-24 を追記

**やらないこと**:
- server / common への変更（client のみ）
- OpenAPI フローへの影響なし
- コメント折りたたみ・深さ制限（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `parentComment` が渡されたとき、引用プレビュー（`data-testid="comment-quote-preview"`）が描画される
2. 引用テキストは親コメントの `text` を最大 40 文字に切り詰め、41 文字以上は末尾に「…」を付加する（コードポイント単位）
3. `parentComment` が `null` / 未指定のとき、引用プレビューは描画されない
4. 引用プレビュー要素は `<a href="#comment-${parentComment.id}">` を持ち、クリックでスムーズスクロールする
5. `renderCommentTree` は `comment.parent_comment_id` で `commentMap` を引き当て、`parentComment` に渡す
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### UI（`CommentCard.tsx`）

- `CommentCardProps` の非ローディングブランチに `parentComment?: Comment | null` を追加
- 本文（`MarkdownContent`）の直上に `QuotePreview` を配置
- スタイル: グレー背景の引用枠（Reddit 風）
  ```
  bgcolor: 'grey.100'
  borderLeft: '3px solid'
  borderColor: 'grey.400'
  borderRadius: '0 4px 4px 0'
  pl: 1, py: 0.25, mb: 0.5
  cursor: 'pointer'
  ```
- リンクは `<a href="#comment-${id}">` で history push を使わず anchor スクロール（`scroll-behavior: smooth` は `html` 要素に既設済みか確認）

### データフロー（`PostThreadScene.tsx`）

`renderCommentTree` 内で以下を追加:
```tsx
const parentComment = comment.parent_comment_id
  ? (commentMap.get(comment.parent_comment_id) ?? null)
  : null;
```
`CommentCard` に `parentComment={parentComment}` を渡す。

### テキスト切り詰め

```ts
const chars = [...text]; // コードポイント単位
const truncated = chars.length > 40
  ? chars.slice(0, 40).join("") + "…"
  : text;
```

## 5. 影響範囲 / 既存への変更

- `client/src/components/CommentCard.tsx` — prop 追加 + UI 追加
- `client/src/components/CommentCard.test.tsx` — テスト追加
- `client/src/routes/PostThreadScene.tsx` — `renderCommentTree` 内で `parentComment` を渡す
- `e2e/post-thread/usecases.md` — UC-POST-24 追記

## 6. テスト計画（TDDで書くテスト一覧）

`CommentCard.test.tsx` に追加するテスト（`describe("引用プレビュー（#931）")` ブロック）:

1. `parentComment` が渡されたとき `data-testid="comment-quote-preview"` が描画される
2. 40 文字以内のテキストはそのまま表示（"…" なし）
3. 41 文字以上のテキストは 40 文字 + "…" に切り詰められる
4. `parentComment` が `null` / 未指定のとき引用プレビューが描画されない
5. 引用プレビューは `href="#comment-<parentId>"` を持つ

## 7. リスク・未決事項

- `mockComment` の型に `parent_comment_id` が含まれていない（既存テスト用）が、`parentComment` はコンポーネントへの prop で渡すため型の問題なし
- スムーズスクロールは `html { scroll-behavior: smooth }` がグローバルで設定されていることを前提とする（anchor クリックで自動適用）
