# 設計書: コメントリンクをクリップボードにコピー＆自動スクロール (#861)

## 1. 目的 / 背景

GitHub のように、コメントの共有ボタンをクリックして URL をコピーし、そのリンクを開いたとき該当コメントまで自動スクロールする機能を追加する。

ShareButton による `#comment-{commentId}` URL のコピーは Issue #775 で既に実装済みだが、そのリンクを開いたときに実際にコメントまでスクロールする処理が存在していなかった。

## 2. スコープ（やること / やらないこと）

### やること
- 各コメント div に `id="comment-{comment.id}"` 属性を追加する
- PostThreadScene に `useEffect` を追加し、URL ハッシュが `#comment-{id}` パターンのとき対象コメントへスクロールする

### やらないこと
- コメントのハイライト（視覚的強調）— スクロールのみ対応
- ハッシュ変化の watch（ページ読み込み時の一度のスクロールのみ）
- コメントリンクのコピー UI の変更（ShareButton は既存のまま）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] コメントが存在するとき、各コメントの wrapper div に `id="comment-{comment.id}"` が付与されている
- [ ] URL ハッシュが `#comment-{id}` のとき、コメントロード後に `scrollIntoView` が呼ばれる
- [ ] URL ハッシュが `#comment-{id}` でもマッチする要素が存在しないとき、エラーを throw しない

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `id` 属性の追加

`PostThreadScene.tsx` の `renderCommentTree` 関数内、各コメント div に `id` を追加する:

```tsx
<div key={comment.id} id={`comment-${comment.id}`} ref={commentRef(comment.id)}>
```

`shareUrl` は既に `#comment-${comment.id}` 形式で組み立てられているため（CommentCard.tsx:90）、`id="comment-{comment.id}"` と一致する。

### スクロール処理

PostThreadScene コンポーネント内に `useEffect` を追加する:

```tsx
useEffect(() => {
  const hash = window.location.hash;  // e.g. "#comment-cm_xxx"
  if (!hash.startsWith("#comment-")) return;
  const el = document.getElementById(hash.slice(1));  // "comment-cm_xxx"
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}, [comments]);
```

依存配列に `comments` を置くことで、コメントデータが Suspense で解決された後（DOM に comment div が出現した後）にスクロールを実行する。

## 5. 影響範囲 / 既存への変更

- `client/src/routes/PostThreadScene.tsx`: `useEffect` 追加・comment div に `id` 追加
- `client/src/routes/PostThreadScene.test.tsx`: 新規テスト追加

## 6. テスト計画（TDDで書くテスト一覧）

1. コメント div に `id="comment-{comment.id}"` が付与されている
2. `window.location.hash = "#comment-comment-1"` のとき `scrollIntoView` が呼ばれる
3. `window.location.hash` が存在しない id を指すときエラーにならない

## 7. リスク・未決事項

- jsdom では `scrollIntoView` が未実装のため、テストでは `Element.prototype.scrollIntoView` をモックする
- 実際のコメント ID は CUID 形式（例: `cm_abc123`）だが、テストフィクスチャは `"comment-1"` を使用するため、id は `"comment-comment-1"` になる（整合しているが冗長に見える点に注意）
