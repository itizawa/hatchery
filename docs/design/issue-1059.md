# 設計書: fix: 投稿検索結果画面で vote 状態が常に未投票表示になり vote 操作の整合性が崩れる (#1059)

## 1. 目的 / 背景

`/search` ページ（`client/src/routes/SearchScene.tsx`）の検索結果一覧は `PostCard` に `currentVote={null}` を常に固定値で渡している。ホームフィード・コミュニティフィードでは各投稿の `my_vote`（sessionId に紐づく現在のvote状態）をAPIレスポンスから取得し `PostCard` の `currentVote` に反映する設計（#831 等）だが、検索結果だけはこの経路が無く、`GET /api/posts/search` のレスポンス自体にも `my_vote` フィールドが含まれていない。

この結果、既に up/down vote 済みの投稿を検索結果で見ても常に「未投票」の見た目になり、視覚的フィードバックが他画面と食い違う。

## 2. スコープ

**やること**:
- `GET /api/posts/search` に `sessionId` クエリパラメータ（任意・UUID）を追加し、付与時は各 post に `my_vote` を付与する（`GET /api/feed` / `GET /api/posts/:postId` と同じパターン）。
- `client/src/api/search.ts` の `fetchSearchPosts` / `useSearchPosts` が `sessionId` をクエリに渡すよう修正する（`useInfiniteHomeFeed` 等と同じ sessionId 注入パターン）。
- `client/src/routes/SearchScene.tsx` の `PostCard` に渡す `currentVote` を、固定 `null` ではなく各投稿の `my_vote` から算出する値に変更する。

**やらないこと**:
- vote API（`POST /api/posts/:postId/vote`）自体の変更。
- common の `PostSchema` 変更（`my_vote` は #831 で既にスキーマに定義済み・変更不要）。

## 3. 受け入れ条件

1. `GET /api/posts/search?q=...&sessionId=<uuid>` は、`sessionId` に紐づく投票済み post に対して `my_vote`（"up" | "down"）を含めて返す。
2. `sessionId` 未指定時は `my_vote` を含まない（後方互換）。
3. `client/src/api/search.ts` の `useSearchPosts` は `sessionId`（ログイン済みは userId、ゲストは `getOrCreateGuestId()`）をクエリに付与してリクエストする。
4. `SearchScene.tsx` の検索結果一覧は、投票済み post を `PostCard` 上で正しく投票済み表示にする（`currentVote` が `post.my_vote ?? null`）。
5. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針

`GET /api/feed`（`server/src/routes/feed.ts`）・`GET /api/posts/:postId`（`server/src/routes/posts.ts`）と同一パターンを `GET /api/posts/search` に適用する:

- サーバ: `extractSessionId(req)` で UUID 検証付きに sessionId を取得 → `voteRepo.findVotesBySessionAndTargets({ sessionId, targetType: "post", targetIds })` で一括取得 → `toPostResponse({ ...post, myVote })` に反映。
- OpenAPI: `registerPosts.ts` の `/api/posts/search` の `request.query` に `SearchQuerySchema.extend({ sessionId: z.string().uuid().optional() })` を使う。
- クライアント: `fetchSearchPosts` に `sessionId?: string` を追加し `openApiClient.GET` の query に渡す。`useSearchPosts` は `useAuth()` + `getOrCreateGuestId()`（`client/src/api/votes.ts`）で sessionId を解決し渡す（`useInfiniteHomeFeed` と同じパターン）。
- `SearchScene.tsx`: `currentVote={post.my_vote ?? null}` に変更。

## 5. 影響範囲

- `common/`: 変更なし（`PostSchema.my_vote` は既存）。
- `server/`: `server/src/routes/posts.ts`（`/posts/search` ハンドラ）、`server/src/openapi/registrations/registerPosts.ts`。
- `client/`: `client/src/api/search.ts`、`client/src/routes/SearchScene.tsx`。

## 6. テスト計画（TDD）

- **server**: `server/src/routes/posts.test.ts` に `GET /api/posts/search my_vote 付与` を追加。
  - sessionId 付きで投票済み post を検索すると `my_vote` が付く。
  - sessionId 未指定では `my_vote` を含まない（後方互換）。
- **client**: `client/src/api/search.test.ts` に、`sessionId` がクエリに含まれることを検証するテストを追加。
- **client**: `client/src/routes/SearchScene.test.tsx` に、検索結果 API が `my_vote: "up"` を返す post について、`PostCard` の up vote ボタンが `aria-pressed="true"` になることを検証するテストを追加。

## 7. リスク・未決事項

特になし。既存の `#831` パターンを流用するのみで新規のドメインロジックは発生しない。
