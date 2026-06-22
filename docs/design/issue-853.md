# 設計書: vote の楽観的更新を修正し塗りつぶし表示（currentVote）と up_count を正しく反映する (#853)

## 1. 目的 / 背景

up vote ボタンを押しても VoteControl の塗りつぶし（primary.main 背景）が変わらず、up_count の数値も正しく増減しない問題を修正する。既存コードを調査した結果、以下が判明した：

- `PostSchema` / `CommentSchema` の `my_vote` フィールドは既に追加済み（#831）
- サーバ GET スレッドエンドポイントでは sessionId 付きリクエスト時に `my_vote` を解決済み（#831）
- シーン（PostThreadScene / HomeFeedScene / CommunityScene）への `currentVote` 配線も実装済み
- 楽観的更新の toggle/switch ロジックも既に修正済み（#831 レビュー）

残っている未実装部分は以下 2 点：

1. POST vote レスポンスに `my_vote`（確定後の投票方向）が含まれていない
2. `onSuccess` でサーバ確定値をスレッドキャッシュに反映する処理がない（`onSettled` の invalidate に頼っている）

## 2. スコープ（やること / やらないこと）

### やること
- `VoteRepository.voteAndApplyScore` の戻り値に `currentDirection: VoteDirection | null` を追加
- in-memory / Prisma 両実装を更新して `currentDirection` を返す
- `POST /api/posts/:postId/vote` のレスポンスに `my_vote: currentDirection` を含める
- `POST /api/comments/:commentId/vote` のレスポンスに `my_vote: currentDirection` を含める
- `useVotePost` に `onSuccess` を追加し POST レスポンス（`my_vote` 込み）でスレッドキャッシュを更新
- `useVotePost.onSettled` から `postThreadQueryKey` invalidate を削除（feed/community invalidate は維持）
- `useVoteComment` に `onSuccess` を追加し POST レスポンス（`my_vote` 込み）でスレッドキャッシュのコメントを更新
- `useVoteComment.onSettled` の `postThreadQueryKey` invalidate を削除

### やらないこと
- ゲストユーザーのページ再読み込み後の `my_vote` 復元（別 Issue）
- feed エンドポイントの `my_vote` 解決（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `voteAndApplyScore` が `currentDirection: VoteDirection | null` を返す
   - 未投票 → up: `currentDirection === "up"`
   - 未投票 → down: `currentDirection === "down"`
   - up 済み → up (toggle off): `currentDirection === null`
   - down 済み → down (toggle off): `currentDirection === null`
   - up 済み → down (switch): `currentDirection === "down"`
   - down 済み → up (switch): `currentDirection === "up"`
2. POST `/api/posts/:postId/vote` のレスポンスボディに `my_vote` フィールドが含まれる（toggle off 時は省略または null）
3. POST `/api/comments/:commentId/vote` のレスポンスボディに `my_vote` フィールドが含まれる
4. `useVotePost.onSuccess` がサーバ応答の `my_vote` でスレッドキャッシュの `post.my_vote` を更新する
5. `useVotePost.onSettled` は `postThreadQueryKey` を invalidate しない（communityFeed / homeFeed は継続）
6. `useVoteComment.onSuccess` がサーバ応答の `my_vote` で対象コメントの `my_vote` を更新する
7. `useVoteComment.onSettled` は `postThreadQueryKey` を invalidate しない
8. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `currentDirection` の計算ロジック
| 遷移 | `currentDirection` |
|------|-------------------|
| !existing → create | `direction` |
| existing.direction === direction → delete (toggle off) | `null` |
| existing.direction !== direction → update (switch) | `direction` |

### VoteRepository インターフェース変更
```ts
voteAndApplyScore(...): Promise<{
  scoreDelta: number;
  upCountDelta: number;
  score: number | null;
  currentDirection: VoteDirection | null;  // 新規追加
}>
```

### server routes/posts.ts 変更
POST vote レスポンスに `myVote: currentDirection` を渡す:
```ts
res.status(200).json(toPostResponse({
  ...post,
  score: score ?? post.score,
  upCount: post.upCount + upCountDelta,
  commentCount,
  myVote: currentDirection,  // 追加
}));
```

### client votes.ts 変更
`useVotePost`:
- `onSuccess` でサーバ応答 post（`my_vote` 込み）をスレッドキャッシュの post に適用
- `onSettled` から `postThreadQueryKey` invalidate を削除

`useVoteComment`:
- `onSuccess` でサーバ応答 comment（`my_vote` 込み）でスレッドキャッシュのコメントを更新
- `onSettled` を削除（feed invalidation 不要）

## 5. 影響範囲 / 既存への変更

- `server/src/persistence/voteRepository.ts` — インターフェース更新・in-memory 実装更新
- `server/src/persistence/prismaVoteRepository.ts` — `applyVoteMutation` と `voteAndApplyScore` 更新
- `server/src/routes/posts.ts` — POST vote レスポンスに `myVote` 追加
- `client/src/api/votes.ts` — `onSuccess` 追加・`onSettled` 更新
- テストファイル：`voteRepository.test.ts`, `prismaVoteRepository.test.ts`, `votes.test.ts`

## 6. テスト計画（TDDで書くテスト一覧）

### server/src/persistence/voteRepository.test.ts（in-memory）
- `voteAndApplyScore` が各遷移で正しい `currentDirection` を返す（6パターン）

### server/src/persistence/prismaVoteRepository.test.ts（integration, skip if no DB）
- `voteAndApplyScore` が `currentDirection` を返す（代表ケース）

### server/src/routes/posts.test.ts
- POST vote で `my_vote` がレスポンスに含まれることを確認

### client/src/api/votes.test.ts
- `useVotePost.onSuccess` が `my_vote` でキャッシュを更新することを確認
- `useVotePost.onSettled` が `postThreadQueryKey` を invalidate しないことを確認
- `useVoteComment.onSuccess` が `my_vote` でキャッシュを更新することを確認

## 7. リスク・未決事項

- `onSettled` の `postThreadQueryKey` invalidate 削除により、サーバ確定値の `score` や `up_count` がキャッシュに反映されるのは `onSuccess` 経由になる。`communityFeed` / `homeFeed` は引き続き `onSettled` で invalidate するため feed 表示の整合性は維持される。
- ゲストセッションのみの問題（ページ再読み込みで `my_vote` が null に戻る）は今回スコープ外。
