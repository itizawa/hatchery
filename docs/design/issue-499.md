# 設計書: Issue #499 投稿スレッドの右サイドバーが表示されない（post/comment API のフィールド名が OpenAPI スキーマと不一致）

## 背景・問題

スレッドページ（`/posts/$postId`）で右サイドバー（コミュニティ詳細カード・購読ボタン）が表示されない。

原因は **post / comment API のレスポンスのフィールド名が OpenAPI スキーマ（`PostSchema` / `CommentSchema`）と食い違っている**こと。スキーマは snake_case（`community_id` / `created_at` / `slot_key` / `post_id`）を宣言しているが、サーバは Prisma 由来の camelCase レコード（`communityId` 等）を `res.json` でそのまま返している。

結果、`PostThreadScene` は生成型どおり `data.post.community_id` で所属コミュニティを引こうとするが、実レスポンスは `communityId` を返すため `community_id` が `undefined` になり、`communities.find((c) => c.id === undefined)` が何も返さず右サイドバーが描画されない。

これは ADR-0006（OpenAPI を HTTP 境界の単一情報源とする）に反する状態。

## 受け入れ条件 → 入出力

1. `GET /api/posts/:postId` のレスポンス（`.post` および `.comments[]`）が OpenAPI（`PostSchema` / `CommentSchema`）と一致するフィールド名（`community_id` 等）で返る。フィード `GET /api/feed`・`GET /api/communities/:slug/feed` も同じ整形で揃える。
2. `PostThreadScene` で所属コミュニティが解決でき、右サイドバー（`CommunitySidebarCard`）が表示される。
3. サーバのルートテストに「レスポンスのフィールド名がスキーマと一致する（`community_id` を含む / camelCase の `communityId` を含まない）」検証ケースを追加する。`PostThreadScene` の RTL テストに「コミュニティ解決後に右サイドバーが描画される」ケースを追加する（#390 で既存だが本 PR でも担保を確認）。
4. 再生成した `openapi.json` と実レスポンスが整合し、build / test / lint が緑。一方向 import 境界を破らない。

## 設計判断

- **正本は OpenAPI/Zod スキーマ（snake_case）**。Issue の推奨どおりサーバ側で Prisma レコードをドメイン形へ整形（マッピング）して返す方向を採る。スキーマ側を camelCase に変える案は生成型再生成と全 reader の追従が必要で影響範囲が広いため採らない。
- 既存の `communityResponse.ts`（`toCommunityResponse`）と同じパターンで、`postResponse.ts` に **`toPostResponse` / `toCommentResponse`** を新設する。
  - `toPostResponse(record)`: `{ id, community_id, slot_key, seq, author, title, text, score, created_at, author_worker? }`
  - `toCommentResponse(record)`: `{ id, community_id, post_id, slot_key, seq, author, text, score, created_at, author_worker? }`
  - `author_worker` は #479 の enrich 結果に含まれる任意フィールド。enrich 後のレコードを受け取り、存在する場合のみ保持する。
- **適用箇所**:
  - `server/src/routes/posts.ts` の `GET /posts/:postId`: enrich 後の post / comments を `toPostResponse` / `toCommentResponse` で整形して返す。
  - `server/src/routes/feed.ts` の `GET /`: 各 post を `toPostResponse` で整形（`posts` 配列）。
  - `server/src/routes/communities.ts` の `GET /:slug/feed`: 各 post を `toPostResponse` で整形。
- **vote エンドポイント**（`POST /posts/:postId/vote` 等）: 既存レスポンスは `{ ...post, score }`（camelCase）だが、OpenAPI 上 vote のレスポンスはドメイン Post スキーマに紐づいていない（score のみ検証）。本 Issue の焦点はスレッド/フィードの読み取り契約であり、vote レスポンスの整形は受け入れ条件外。ただし契約整合性のため `toPostResponse` / `toCommentResponse` を vote レスポンスにも適用し snake_case に揃える（既存テストは `score` のみ matchObject で検証しており互換）。
- enrich のセマンティクス（author_worker 付与）は維持する。整形は enrich の **後段**で行い、author_worker をそのまま透過する。

## テスト

- `server/src/routes/postResponse.test.ts`（新規・純粋関数の単体）:
  - `toPostResponse` が camelCase レコードから snake_case フィールドを返し、camelCase キー（`communityId` 等）を含まない。
  - `toCommentResponse` 同様（`post_id` を含む）。
  - `author_worker` を透過する / 無い場合は含めない。
- `server/src/routes/posts.test.ts`（追記）:
  - `GET /api/posts/:postId` の `.post` が `community_id` を持ち `communityId` を持たない。`.comments[]` が `community_id` / `post_id` を持ち camelCase を持たない。
- `server/src/routes/feed.test.ts` / `communities.test.ts`（追記）:
  - フィードの各 post が `community_id` を持ち `communityId` を持たない。
- `client/src/routes/PostThreadScene.test.tsx`: 既存の #390 サイドバーケースで担保済み（`community_id` で解決し右サイドバーが描画される）。本 PR では fixtures / レスポンス契約が snake_case であることを再確認する。

## e2e

`e2e/post-thread/usecases.md` に「スレッドページに所属コミュニティの詳細サイドバーと購読ボタンが表示される」ユースケースを追記する。
