# 設計書: コミュニティフィードに無限スクロール（ページネーション）を追加する (#881)

## 1. 目的 / 背景

ホームフィード（`/api/feed`）はカーソルページネーション対応済みだが、コミュニティフィード（`/api/communities/:slug/feed`）は全件一括返却のまま。投稿数が増えるとサイレント打ち切り・初期ロード増大が発生する。ホームフィードと同構造のカーソルページネーションを導入し、無限スクロールで快適な閲覧体験を提供する。

## 2. スコープ

### やること
- `PostRepository` に `listByCommunityPaged` メソッドを追加（カーソルページネーション）
- `GET /api/communities/:slug/feed` に `cursor`・`limit` クエリパラメータを追加
- レスポンス形式を `Post[]` → `{ posts: Post[], nextCursor: string | null }` に変更
- `common/src/domain/feed/feed.ts` に `CommunityFeedQuerySchema` / `CommunityFeedResponseSchema` を追加
- OpenAPI スキーマ（`registerCommunities.ts`）を更新
- `client/src/api/feed.ts` の `useCommunityFeed` を `useSuspenseInfiniteQuery` ベースに変更
- `CommunityScene.tsx` に sentinel + IntersectionObserver を追加
- サーバ側・クライアント側のテストを更新

### やらないこと
- `sort=popular` 対応（別 Issue #886）
- 既存の `listByCommunity` メソッドの削除（バッチ等で使用中）

## 3. 設計方針

### ホームフィードの既存パターンを踏襲

| 層 | ホームフィード（既存） | コミュニティフィード（本 Issue） |
|----|----------------------|-------------------------------|
| Zod スキーマ | `HomeFeedQuerySchema` | `CommunityFeedQuerySchema`（cursor + limit のみ。sort は #886） |
| Repository | `listLatestPaged(cursor?, limit?, options?)` | `listByCommunityPaged(communityId, cursor?, limit?, options?)` |
| Route | `GET /api/feed` → `{ posts, nextCursor }` | `GET /api/communities/:slug/feed` → `{ posts, nextCursor }` |
| OpenAPI | `registerFeed.ts` | `registerCommunities.ts` |
| Client fetch | `fetchHomeFeedPage()` | `fetchCommunityFeedPage()` |
| Client hook | `useInfiniteHomeFeed()` → `useSuspenseInfiniteQuery` | `useInfiniteCommunityFeed()` → `useSuspenseInfiniteQuery` |
| UI | `HomeFeedScene` → sentinel + IntersectionObserver | `CommunityScene` → 同パターン |

### カーソル形式

ホームフィードと同じ `{ createdAt: ISO文字列, id: string }` の base64 エンコード。既存の `encodeCursor` / `decodeCursor` をそのまま再利用。

### limit デフォルト値

ホームフィードと統一して 20。既存の `listByCommunity` はデフォルト 50 だが、ページネーション導入後は初期ロードを軽くするため 20 に合わせる。

### 後方互換

レスポンス形式が `Post[]` → `{ posts: Post[], nextCursor: string | null }` に変わるため、クライアント側も同時に更新する。OpenAPI 生成フローで型の不整合はビルド時に検出される。

## 4. 影響範囲

| ファイル | 変更内容 |
|---------|--------|
| `common/src/domain/feed/feed.ts` | `CommunityFeedQuerySchema` / `CommunityFeedResponseSchema` を追加 |
| `server/src/persistence/postRepository.ts` | `listByCommunityPaged` をインターフェース・インメモリ実装に追加 |
| `server/src/persistence/prismaPostRepository.ts` | `listByCommunityPaged` の Prisma 実装を追加 |
| `server/src/routes/communities.ts` | `/:slug/feed` ルートをページネーション対応に変更 |
| `server/src/routes/communities.test.ts` | 既存テスト更新 + ページネーションテスト追加 |
| `server/src/openapi/registrations/registerCommunities.ts` | コミュニティフィードの OpenAPI スキーマ更新 |
| `client/src/api/feed.ts` | `fetchCommunityFeedPage` / `useInfiniteCommunityFeed` に変更 |
| `client/src/routes/CommunityScene.tsx` | sentinel + IntersectionObserver 追加 |

## 5. テスト計画

### server/src/routes/communities.test.ts（既存テスト更新 + 新規追加）
- レスポンスが `{ posts: [...], nextCursor: ... }` 形式になること
- cursor なしの初回取得で posts と nextCursor が返ること
- cursor 指定で次ページが取得でき、重複・ギャップがないこと
- 末尾ページで nextCursor が null になること
- limit パラメータが機能すること
- 不正な cursor で 400 が返ること
- 既存テスト（slug/feed の snake_case・author_worker・404）はレスポンス形式変更に合わせて更新

### server/src/persistence/postRepository.test.ts（新規追加）
- `listByCommunityPaged` の基本ページネーション
- reveal フィルタとの組み合わせ
