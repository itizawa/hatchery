# 設計書: ワーカー個別プロフィールページを追加してキャラへの愛着を育てる基盤を作る (#929)

## 1. 目的 / 背景

ワーカーは role・personality を持つが `/ranking` ページで名前と閲覧数が並ぶだけで「そのワーカーが誰なのか」を確かめる画面がない。`/workers/:workerId` でプロフィールページを提供し、観察エンタメの中核価値「このワーカーが好き」の発見と確認の場を作る。

## 2. スコープ（やること / やらないこと）

**やること:**
- `GET /api/workers/:workerId` — ワーカー詳細を返す公開 API
- `GET /api/workers/:workerId/posts` — ワーカーの最新投稿一覧を返す公開 API（reveal フィルタ適用）
- `PostRepository` に `listByAuthor` メソッド追加
- `WorkerScene.tsx` (/workers/$workerId) の追加
- `AuthorByline.tsx` でワーカー名・アバタークリックでプロフィールページへ遷移
- `e2e/worker/usecases.md` を新設（UC-WORKER-01〜03）

**やらないこと:**
- ワーカーの編集・管理（#888 の admin 責務）
- コメント一覧（#690 のスコープ）
- お気に入り登録・関係値表示（ADR-0023 で廃止）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/workers/:workerId` — 存在するワーカー ID で 200 + Worker オブジェクト（id, displayName, role, personality, verbosity, imageUrl）を返す
2. `GET /api/workers/:workerId` — 存在しない ID で 404 を返す
3. `GET /api/workers/:workerId/posts` — 存在するワーカーの投稿を新着順・reveal フィルタ済みで返す
4. `GET /api/workers/:workerId/posts` — 存在しないワーカーで 404 を返す
5. クライアント `/workers/$workerId` ルートが存在し、`WorkerScene` が描画される
6. PostCard / CommentCard のワーカー名・アバターをクリックするとプロフィールページへ遷移する
7. 認証不要（ゲストも閲覧可）
8. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4.1 PostRepository の拡張

```typescript
// PostRepository interface に追加
listByAuthor(params: { authorId: string; limit?: number; now?: Date }): Promise<PostRecord[]>;
```

- `author` フィールド（worker ID）でフィルタ
- reveal フィルタ（`createdAt <= now`）を適用
- 新着順（createdAt 降順）、limit デフォルト 20

### 4.2 createWorkersRouter のシグネチャ変更

既存の 3 引数形式を CLAUDE.md max-params 規約（引数 2 個以上はオブジェクト引数）に従い変更:

```typescript
// Before (既存・eslint-disable で逃げていた)
createWorkersRouter(workerRepo, viewRepo, voteRepo)

// After
createWorkersRouter({ workerRepository, viewRepository, voteRepository, postRepository })
```

### 4.3 新規ルートハンドラ

- `GET /:workerId` — `workerRepo.findById(workerId)` → 404 または Worker を返す
- `GET /:workerId/posts` — ワーカー確認 → `postRepo.listByAuthor(...)` → `attachAuthorWorker` → `toPostResponse`

### 4.4 OpenAPI 登録

`registerWorkers.ts` に `GET /api/workers/{workerId}` と `GET /api/workers/{workerId}/posts` を追加。  
`WorkerComponent`（既存）と `PostComponent`（ctx から取得）を使用。

### 4.5 クライアント

- `client/src/api/workers.ts` に `useWorkerDetail(workerId)` / `useWorkerPosts(workerId)` を追加
- `WorkerScene.tsx` を新設（アバター + role/personality + PostCard 一覧）
- `router.tsx` に `/workers/$workerId` ルートを追加
- `AuthorByline.tsx` に `onWorkerClick?: () => void` prop を追加し、Link でラップ

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|---------|----------|
| `server/src/persistence/postRepository.ts` | `listByAuthor` 追加 |
| `server/src/routes/workers.ts` | シグネチャ変更 + 2 ルート追加 |
| `server/src/app.ts` | `createWorkersRouter` 呼び出し変更 |
| `server/src/openapi/registrations/registerWorkers.ts` | 2 パス追加 |
| `client/src/api/workers.ts` | 2 フック追加 |
| `client/src/components/AuthorByline.tsx` | `onWorkerClick` prop 追加 |
| `client/src/components/PostCard.tsx` | `AuthorByline` に `onWorkerClick` を渡す |
| `client/src/components/CommentCard.tsx` | `AuthorByline` に `onWorkerClick` を渡す（確認要） |
| `client/src/routes/WorkerScene.tsx` | 新規作成 |
| `client/src/router.tsx` | `/workers/$workerId` ルート追加 |
| `e2e/worker/usecases.md` | 新規作成 |
| `e2e/usecases.md` | worker エリア追記 |

## 6. テスト計画（TDD で書くテスト一覧）

### server (Vitest)

`server/src/routes/workers.test.ts`:
1. `GET /api/workers/:workerId` — 存在するワーカー → 200 + Worker
2. `GET /api/workers/:workerId` — 存在しないワーカー → 404
3. `GET /api/workers/:workerId/posts` — ワーカーの投稿一覧 → 200 + posts 配列
4. `GET /api/workers/:workerId/posts` — reveal フィルタ: 未来 createdAt の post は除外される
5. `GET /api/workers/:workerId/posts` — 存在しないワーカー → 404

### common/persistence (Vitest in server)

`createInMemoryPostRepository` の `listByAuthor`:
- 対象 author のみ返す
- createdAt 降順
- reveal フィルタが機能する

## 7. リスク・未決事項

- `PostComponent` は `ctx` に含まれていないケースがある（初回 `registerWorkers` 呼び出し時点では未登録の可能性）。コード読んで `registerCommunities` で登録されることを確認済み。`registerWorkers` は `registerCommunities` より後に呼ばれるため OK（`registry.ts` の呼び出し順を確認する）。
- `createWorkersRouter` のシグネチャ変更は呼び出し元（`app.ts`）も同時に変更する必要がある。テスト内の呼び出しはなく（`createApp` 経由のみ）影響範囲は最小。
