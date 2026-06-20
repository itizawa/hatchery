# 設計書: vote 済み塗りつぶし反映 (#831)

## 1. 目的 / 背景

PR #826（Issue #813）で `VoteControl` に投票済み塗りつぶし表示を実装したが、実際には 2 層の問題で機能していない。

- **① サーバーが `my_vote` を返していない**: GET エンドポイントにセッションコンテキストがなく、投票済みかを判定できない。
- **② `currentVote` プロップが各画面で VoteControl に渡されていない**: 仮にサーバーが返しても受け取る実装がない。楽観更新も `my_vote` を更新していない。

## 2. スコープ（やること / やらないこと）

### やること
- `PostSchema` / `CommentSchema` に `my_vote: "up" | "down" | null` を任意フィールドとして追加
- GET /api/feed / GET /api/posts/:postId / GET /api/communities/:slug/feed に `sessionId` クエリパラメータ（任意）を追加し、投票済みの post/comment に `my_vote` を付与
- `VoteRepository` に `findVotesBySessionAndTargets` を追加（batch 取得）
- クライアントの各フックに sessionId クエリ付与
- HomeFeedScene / CommunityScene / PostThreadScene で `currentVote` を配線
- `useVotePost` / `useVoteComment` の楽観更新に `my_vote` フィールド更新を追加

### やらないこと
- sessionId の Cookie / Bearer ヘッダー化
- 認証ログイン後の vote 状態引き継ぎ（別 Issue）
- VoteControl 自体の表示実装（#813 で実装済み）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PostSchema.parse({ ..., my_vote: "up" })` が成功し、`my_vote: "up"` を返す
2. `PostSchema.parse({})` で `my_vote` を省略しても成功する（optional）
3. `CommentSchema` も同様
4. `VoteRepository.findVotesBySessionAndTargets({ sessionId, targetType, targetIds })` が sessionId の投票済み targetId → direction の Map を返す
5. `toPostResponse({ ...record, myVote: "up" })` が `{ my_vote: "up", ... }` を返す
6. `toPostResponse({ ...record })` で `myVote` 省略時は `my_vote` を含まない
7. `GET /api/feed?sessionId=<uuid>` で投票済みの post に `my_vote: "up"|"down"` が付く
8. `GET /api/posts/:id?sessionId=<uuid>` で投票済みの post/comment に `my_vote` が付く
9. sessionId 未指定時は `my_vote` を含まない（後方互換）
10. クライアントの `useInfiniteHomeFeed` / `useCommunityFeed` / `usePostThread` が sessionId を付与してリクエストを送る
11. `HomeFeedScene` / `CommunityScene` の PostCard に `post.my_vote` が `currentVote` として渡る
12. `PostThreadScene` の PostCard と CommentCard に `my_vote` が渡る
13. `useVotePost` の楽観更新で `my_vote` が正しく更新される（up 押下 → "up"、toggle → null）
14. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### VoteRepository 拡張
既存の `findVote` は単一ターゲット用。複数 post/comment を一括で取得するために `findVotesBySessionAndTargets` を追加する。

```typescript
findVotesBySessionAndTargets({
  sessionId,
  targetType,
  targetIds,
}: {
  sessionId: string;
  targetType: VoteTargetType;
  targetIds: string[];
}): Promise<Map<string, VoteDirection>>;
```

### PostResponse のパターン
`author_worker` / `commentCount` の既存パターンに倣い、`myVote` を `EnrichedPostRecord` / `EnrichedCommentRecord` のオプションフィールドとして追加する。関数シグネチャ（単一引数）は変わらない。

### sessionId クエリパラメータ
- GET /api/feed: `HomeFeedQuerySchema` への追加ではなく、`req.query.sessionId` を別途 Zod で検証する。  
- GET /api/posts/:id / GET /api/communities/:slug/feed: 同様に `req.query.sessionId` を別途検証する。

### クライアント型
`my_vote` は `optional` フィールドのため、server の openapi.json 再生成後に `openapi-typescript` が `my_vote?: "up" | "down" | null` として生成する。クライアントコードは `post.my_vote ?? null` で参照する。

### 楽観更新の my_vote ロジック
```typescript
const prevMyVote = previous.post.my_vote ?? null;
const newMyVote = prevMyVote === direction ? null : direction;
// toggle off: null、switch or new: direction
```

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更内容 |
|---|---|---|
| common | `domain/post/post.ts` | PostSchema に `my_vote` 追加 |
| common | `domain/comment/comment.ts` | CommentSchema に `my_vote` 追加、VoteDirectionSchema import |
| server | `persistence/voteRepository.ts` | `findVotesBySessionAndTargets` 追加 |
| server | `routes/postResponse.ts` | EnrichedPostRecord / CommentRecord に `myVote?` |
| server | `routes/feed.ts` | sessionId 追加、voteRepo 引数追加 |
| server | `routes/posts.ts` | sessionId 追加 |
| server | `routes/communities.ts` | sessionId 追加 |
| server | `app.ts` | `createFeedRouter` / `createCommunitiesRouter` に voteRepo 追加 |
| client | `api/feed.ts` | sessionId クエリ付与 |
| client | `api/posts.ts` | sessionId クエリ付与 |
| client | `api/votes.ts` | 楽観更新に `my_vote` 追加 |
| client | `routes/HomeFeedScene.tsx` | `currentVote` 配線 |
| client | `routes/CommunityScene.tsx` | `currentVote` 配線 |
| client | `routes/PostThreadScene.tsx` | `currentVote` 配線 |

## 6. テスト計画

- **common**: PostSchema / CommentSchema の `my_vote` optional フィールドテスト
- **server voteRepository**: `findVotesBySessionAndTargets` の単体テスト
- **server postResponse**: `myVote` あり / なし の `toPostResponse` / `toCommentResponse` テスト
- **server feed**: `GET /api/feed?sessionId=<uuid>` で `my_vote` が付く統合テスト
- **server posts**: `GET /api/posts/:id?sessionId=<uuid>` で `my_vote` が付く統合テスト

## 7. リスク・未決事項

- community feed の `GET /api/communities/:slug/feed` にも sessionId を追加するが、既存テストのカバレッジは薄い
- Prisma 実装（`prismaVoteRepository.ts`）には `findVotesBySessionAndTargets` の実装が必要だが、本 Issue では in-memory 実装のみ対応し、Prisma 実装は別途追加する
