# Issue #775: コメントに共有ボタンを追加する

## 目的

`CommentCard` のアクションバーに `ShareButton` を追加し、コメントへのパーマリンクを SNS でシェアできるようにする。

## 設計方針

### props 設計

`CommentCard` に `postId` props（`string`）を追加する。`shareUrl` は `CommentCard` の内部で組み立てる。
- 呼び出し元（`PostThreadScene`）はすでに `postId`（= `post.id`）を保持しているので、追加の API コールは不要。

### shareUrl / shareTitle の組み立て

```ts
const shareUrl  = `${window.location.origin}/posts/${postId}#comment-${comment.id}`;
const shareTitle = comment.text.slice(0, 50) + (comment.text.length > 50 ? "…" : "");
```

- `comment.text` は Markdown 生テキストだが、先頭 50 字という粒度で十分。
- `window.location.origin` は `"http://localhost"` がテスト環境デフォルトになるため、テストでは `jsdom` の origin をそのまま利用する。

### レイアウト

既存の `VoteControl` の右に `ShareButton` を追加する:

```tsx
<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
  <VoteControl ... />
  <ShareButton shareUrl={shareUrl} shareTitle={shareTitle} />
</Box>
```

### PostThreadScene への変更

`renderCommentTree` の引数オブジェクトに `postId: string` を追加し、`CommentCard` に `postId` を渡す。

## 受け入れ条件マッピング

| # | 条件 | 対応箇所 |
|---|------|---------|
| 1 | `CommentCard` のアクションバーに `ShareButton` が表示される | `CommentCard.tsx` |
| 2 | `shareUrl` は `${origin}/posts/<postId>#comment-<commentId>` | `CommentCard.tsx` 内部 |
| 3 | `shareTitle` はコメント本文の先頭 50 文字 + `…` | `CommentCard.tsx` 内部 |
| 4 | クリックでドロップダウン（URL コピー / X シェア） | `ShareButton` 既存挙動 |
| 5 | `CommentCard` が `postId` props を受け取る | `CommentCard.tsx` |
| 6 | 既存 VoteControl / コネクターライン / インデントに影響なし | 変更最小化 |
| 7 | `CommentCard.test.tsx` にテスト追加 | テストファイル |
| 8 | `pnpm turbo run build test lint` が緑 | CI |

## ファイル変更一覧

- `client/src/components/CommentCard.tsx` — `postId` props 追加・`ShareButton` 追加
- `client/src/routes/PostThreadScene.tsx` — `renderCommentTree` に `postId` を渡す
- `client/src/components/CommentCard.test.tsx` — テスト追加
