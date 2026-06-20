# 設計書: fix: GET /posts/:postId が comment_count を常に 0 で返すバグを修正する (#779)

## 1. 目的 / 背景

投稿詳細 API（`GET /api/posts/:postId`）のレスポンスで `comment_count` が常に 0 になるバグを修正する。
フィードやコミュニティフィードでは `attachCommentCount` を正しく呼び出しているが、
投稿詳細ハンドラだけが `commentCount` を付与せずに `toPostResponse` を呼んでいた。
`toPostResponse` は `r.commentCount ?? 0` で返すため、付与なしの場合は常に 0 になる。

## 2. スコープ（やること / やらないこと）

**やること**
- `server/src/routes/posts.ts` の `GET /posts/:postId` ハンドラで `commentCount: comments.length` を post に付与する
- `server/src/routes/posts.test.ts` に `comment_count` の正確性を確認するテストを追加する
- `e2e/post-thread/usecases.md` に「投稿詳細でコメント数が正しく表示される」の期待動作を追記する

**やらないこと**
- `attachCommentCount` の呼び出し（`comments.length` を直接利用するので追加クエリは発生させない）
- コメント件数のリアルタイム更新・WebSocket 対応

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/posts/:postId` のレスポンス `post.comment_count` が reveal 済みコメント数と一致する
2. `server/src/routes/posts.ts` の `GET /posts/:postId` ハンドラで `commentCount`（= `comments.length`）を post に付与してから `toPostResponse` を呼ぶ
3. `posts.test.ts` に「コメントが N 件ある post を取得すると `comment_count: N` が返る」テストを追加する
4. `comment_count: 0`（コメントなし）のケースもテストでカバーする
5. `pnpm turbo run build test lint` が緑になる
6. `e2e/post-thread/usecases.md` に投稿詳細でのコメント数表示の期待動作を追記する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`GET /posts/:postId` ハンドラは既に `commentRepo.listByPost(postId, { now })` でコメントを取得済み。
その `comments` 配列の `.length` を `commentCount` として post に付与するだけで修正できる（追加クエリなし）。

```typescript
// 変更前
res.status(200).json({
  post: enrichedPost ? toPostResponse(enrichedPost) : toPostResponse(post),
  comments: enrichedComments.map(toCommentResponse),
});

// 変更後
const postWithCount = { ...(enrichedPost ?? post), commentCount: comments.length };
res.status(200).json({
  post: toPostResponse(postWithCount),
  comments: enrichedComments.map(toCommentResponse),
});
```

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更種別 |
|---|---|---|
| server | `src/routes/posts.ts` | fix（1行追加・1行修正） |
| server | `src/routes/posts.test.ts` | test（テスト2件追加） |
| docs | `e2e/post-thread/usecases.md` | docs（UC-POST-17 追記） |

## 6. テスト計画（TDDで書くテスト一覧）

1. `GET /api/posts/:postId` でコメントが 3 件ある場合、`post.comment_count: 3` が返る
2. `GET /api/posts/:postId` でコメントが 0 件の場合、`post.comment_count: 0` が返る

## 7. リスク・未決事項

- 特になし。変更箇所は 1 行のみで影響範囲が限定的。
