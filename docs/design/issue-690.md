# 設計書: ワーカー詳細画面を追加する（所属コミュニティ・投稿コメント一覧）(#690)

## 1. 目的 / 背景

ワーカーごとの所属コミュニティや投稿コメント履歴を一覧できる詳細画面を追加し、
ユーザーがワーカーの個性・活動履歴を観察できるようにする（concept.md「観察エンタメ」の訴求点）。
コメントクリックで PostThread へのアンカー遷移（`#comment-{id}`）も実現する。

なお、`GET /api/workers/:workerId`・`GET /api/workers/:workerId/posts`・`WorkerScene` の基本骨格・
ルート定義・`AuthorByline` のリンク化は #929 で先行実装済み。
本 Issue では残余の機能（コミュニティ一覧・コメント一覧・アンカースクロール）を追加する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `CommentRepository.listByWorker` メソッドの追加（InMemory + Prisma）
- `GET /api/workers/:id/communities` エンドポイント（公開・認証不要）
- `GET /api/workers/:id/comments` エンドポイント（公開・カーソルページネーション・認証不要）
- OpenAPI 登録（上記 2 エンドポイント）
- クライアント hooks: `useWorkerPublicCommunities` / `useWorkerComments`（useInfiniteQuery）
- `WorkerScene.tsx` に所属コミュニティセクション・コメントセクションを追加
- `CommentCard.tsx` のルートコンテナに `id="comment-{commentId}"` 属性を追加
- テスト: InMemory `listByWorker` / WorkerScene の新セクション
- e2e usecases 追記

**やらないこと:**
- ワーカーフォロー機能
- ワーカーの Post 一覧（#929 実装済み）
- 削除済みワーカーの扱い（既存実装に準拠）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommentRepository.listByWorker(workerId, opts)` が author 一致のコメントを createdAt 降順で返す
2. cursor ページネーション: `limit` 件取得し、続きがある場合は `nextCursor` (コメント id) を返す
3. `GET /api/workers/:id/communities` が workerCommunityRepository + communityRepository を使い Community[] を返す
4. `GET /api/workers/:id/communities` でワーカーが存在しない場合 404
5. `GET /api/workers/:id/comments` が listByWorker を使い CommentRecord[] + nextCursor を返す
6. `GET /api/workers/:id/comments` でワーカーが存在しない場合 404
7. WorkerScene に所属コミュニティ一覧カードが表示される（0 件は空状態）
8. WorkerScene にコメント一覧が表示される（0 件は空状態）
9. コメント行クリックで `/posts/:postId#comment-{commentId}` へ遷移する
10. CommentCard のルートコンテナに `id="comment-{commentId}"` が付与される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### server
- `CommentRepository` interface に `listByWorker(workerId, opts?)` を追加
  - opts: `{ limit?: number; cursor?: string }` (limit 既定 20)
  - 戻り値: `{ comments: CommentRecord[]; nextCursor: string | null }`
- `server/src/routes/workers.ts` に 2 エンドポイントを追加
  - 依存注入: `communityRepository` / `workerCommunityRepository` / `commentRepository` を追加
- OpenAPI: `registerWorkers.ts` に 2 パスを追加

### client
- `useWorkerPublicCommunities({ workerId })`: `useSuspenseQuery` (query key: `["workers","communities",workerId]`)
- `useWorkerComments({ workerId })`: `useInfiniteQuery` (query key: `["workers","comments",workerId]`)
- `WorkerScene.tsx` にセクション追加（communities / comments）
- `CommentCard.tsx`: `id` prop を追加してルートコンテナに付与

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|----------|---------|
| `server/src/persistence/commentRepository.ts` | `listByWorker` 追加（interface + InMemory） |
| `server/src/persistence/prismaCommentRepository.ts` | `listByWorker` 追加 |
| `server/src/routes/workers.ts` | 2 エンドポイント追加・依存追加 |
| `server/src/openapi/registrations/registerWorkers.ts` | 2 パス追加 |
| `server/src/server.ts` | router 生成時に communityRepository 等を注入（必要時） |
| `client/src/api/workers.ts` | 2 フック追加 |
| `client/src/routes/WorkerScene.tsx` | セクション追加 |
| `client/src/components/CommentCard.tsx` | id prop 追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### server
- `commentRepository.test.ts`: `listByWorker` の 0 件・複数件・cursor ページネーション
- `workers.test.ts`: `GET /api/workers/:id/communities` 200/404 / `GET /api/workers/:id/comments` 200/404

### client
- `WorkerScene.test.tsx`: 所属コミュニティ表示・コメント表示・コメント空状態・コメントリンク先

## 7. リスク・未決事項

- `communityRepository` を `createWorkersRouter` に追加する際、`server.ts` の依存注入も更新が必要
- `CommentCard` の `id` prop を追加する際、PostThreadScene の wrapper div (`id="comment-{id}"`) との二重付与を避けるため、PostThreadScene 側の `id` 付き div は削除し CommentCard の prop に統合する
