# 設計書: 投稿検索結果に author_worker が付与されず発言者がワーカーIDの生UUIDのまま表示される (#1058)

## 1. 目的 / 背景

`/search` ページの検索結果カードで、発言者が表示名（例:「はやとん社長」）ではなくワーカーIDの生UUID文字列のまま表示される。原因は `server/src/routes/posts.ts` の `GET /posts/search` ハンドラが `buildAuthorWorkerEnricher` / `attachAuthorWorker` を呼ばずに `postRepo.search()` の結果をそのまま `toPostResponse` しているため。同ファイルの `GET /posts/:postId` や `feed.ts` / `communities.ts` は既にこの enrich 処理を行っており、検索結果だけが漏れている。

## 2. スコープ（やること / やらないこと）

- やる: `/posts/search` レスポンスの各 post に `author_worker` を付与する。
- やらない: 検索ロジック自体（ILIKE 部分一致・limit 等）の変更、OpenAPI スキーマの型定義変更（`PostResponse` は既に `author_worker` を optional field として持っているため型定義自体の追加は不要）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `GET /api/posts/search?q=...` のレスポンスの各 post に、author が解決可能なワーカーであれば `author_worker`（`id` / `display_name` / `image_url`）が付与される。
2. 論理削除済み（`listBotWorkers()` の対象外）ワーカーが author の場合は `author_worker` を付与せず、`author` の生文字列のみを返す（既存の feed/communities と同じフォールバック仕様）。
3. `pnpm --filter @hatchery/server openapi` の生成結果（`server/openapi.json`）が既存の `author_worker` スキーマのままで壊れないこと（型定義自体は変更しないため差分なしを期待）。

## 4. 設計方針

`feed.ts` / `communities.ts` と同じパターンで、`postRepo.search()` の結果配列を `attachAuthorWorker(posts, workerRepo)`（単一コレクション向けヘルパー、`authorWorker.ts:47`）に通してから `toPostResponse` する。`attachAuthorWorker` は内部で `buildAuthorWorkerEnricher` → `listBotWorkers()` を呼ぶため、既存の `/posts/:postId` の重複回避パターン（1リクエストで複数コレクションを enrich する場合は `buildAuthorWorkerEnricher` を使い回す）は検索エンドポイントには該当しない（単一コレクションのみのため `attachAuthorWorker` で十分）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server` のみ。
- `server/src/routes/posts.ts` の `/posts/search` ハンドラを変更。
- `common` / `client` の型定義変更なし（`author_worker` は既に `PostResponse` スキーマに存在)。

## 6. テスト計画（TDDで書くテスト一覧）

`server/src/routes/posts.test.ts` に以下を追加:

1. author が解決可能なワーカー displayName のとき、検索結果に `author_worker` が付与される。
2. author が解決不能（存在しないワーカー）のとき、`author_worker` は付与されず `author` の生文字列のまま返る。

## 7. リスク・未決事項

なし。既存の enrich パターンの横展開のみで、新規の設計判断は発生しない。
