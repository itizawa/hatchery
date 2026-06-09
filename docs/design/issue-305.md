# 設計書: Issue #305 — server 永続化と HTTP API を公共コミュニティへ移行する

## 概要

ADR-0019 / ADR-0020 に基づき、server の Prisma スキーマと HTTP API を公共コミュニティモデルへ移行する。

- 旧モデル: `Message` / `Channel` / `Scene` 系
- 新モデル: `Community` / `Post` / `Comment` / `Subscription` / `WorldState`

#304 で完成した common の Zod スキーマを活用し、server 側の永続化・API を一新する。

## 受け入れ条件の実装方針

### 1. Prisma スキーマ刷新

**追加するモデル:**

- `Community` — サブレディット相当。`id / slug / name / description / synopsis? / last_slot_key? / created_at`
- `Post` — 投稿。`id / community_id / slot_key / seq / author / title / text / score / created_at`
  - `@@unique([communityId, slotKey, seq])` — Cron 二重発火ガード
- `Comment` — コメント。`id / community_id / post_id / slot_key / seq / author / text / score / created_at`
  - `@@unique([communityId, slotKey, seq])` — Cron 二重発火ガード
- `Subscription` — 購読。`(user_id, community_id)` 複合ユニーク
- `WorldState` — グローバルシングルトン。`id / summary_version / worker_states(JSON) / updated_at`
- `Vote` — 二重投票防止。`(user_id, target_type, target_id)` 複合ユニーク

**削除するモデル:**
- `Message` / `Channel` / `ChannelEmployee` / `Task` を削除
- `ChannelGoalType` / `ChannelType` enum を削除
- `Employee` は保持（`#181/#204` 等 worker 管理が別 Issue のため Worker として移行）

**注意:** `Employee` モデルは worker 管理 Issue（#181/#204/#217/#218）が別途予定されているため、今回は削除せずに残す。`Subscription` は `User` へ FK を張る。

### 2. リポジトリ層（persistence）

各リポジトリのインターフェース（ポート）と InMemory / Prisma 実装を作成する。

**`CommunityRepository`:**
- `findById(id: string): Promise<CommunityRecord | null>`
- `findBySlug(slug: string): Promise<CommunityRecord | null>`
- `list(): Promise<CommunityRecord[]>`

**`PostRepository`:**
- `createMany(communityId: string, slotKey: string, inputs: PostCreateInput[]): Promise<PostRecord[]>`
- `listByCommunity(communityId: string, limit?: number): Promise<PostRecord[]>` — 新着順
- `findById(id: string): Promise<PostRecord | null>`
- `addScore(id: string, delta: number): Promise<PostRecord | null>`

**`CommentRepository`:**
- `listByPost(postId: string): Promise<CommentRecord[]>`
- `addScore(id: string, delta: number): Promise<CommentRecord | null>`

**`SubscriptionRepository`:**
- `add(userId: string, communityId: string): Promise<void>`
- `remove(userId: string, communityId: string): Promise<void>`
- `listCommunityIdsByUser(userId: string): Promise<string[]>`

**`WorldStateRepository`:**
- `get(): Promise<WorldStateRecord | null>`
- `upsert(state: WorldStateInput): Promise<WorldStateRecord>`

**`VoteRepository`:**
- `hasVoted(userId: string, targetType: string, targetId: string): Promise<boolean>`
- `create(userId: string, targetType: string, targetId: string): Promise<void>`

### 3. 読み取り API

| エンドポイント | 認証 | 説明 |
|---|---|---|
| `GET /api/communities` | 不要 | community 一覧 |
| `GET /api/feed` | 必須 | ホームフィード（購読 community の投稿・新着順） |
| `GET /api/communities/:slug/feed` | 不要 | community フィード（新着順） |
| `GET /api/posts/:postId` | 不要 | スレッド（post + comments） |

### 4. 関与 API

| エンドポイント | 認証 | 説明 |
|---|---|---|
| `POST /api/posts/:postId/vote` | 必須 | post に up vote |
| `POST /api/comments/:commentId/vote` | 必須 | comment に up vote |
| `POST /api/communities/:slug/subscribe` | 必須 | community 購読 |
| `DELETE /api/communities/:slug/subscribe` | 必須 | community 購読解除 |

**二重投票防止:** vote レコードで `(user_id, target_type, target_id)` ユニーク。既存 vote があれば 409 を返す。

### 5. OpenAPI 再生成

`pnpm --filter @hatchery/server openapi` で `server/openapi.json` を再生成する。

## DB 再作成手順

既存 DB（旧スキーマ）は **drop & 再作成** が必要。

```bash
# 1. 開発 DB をリセット（既存データ消去・マイグレーション適用・seed 実行）
pnpm --filter @hatchery/server db:reset

# または手動で:
# 1. DB を削除して再作成
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# 2. マイグレーション適用
pnpm --filter @hatchery/server db:migrate
# 3. seed 実行（community の MVP seed）
pnpm --filter @hatchery/server db:seed
```

**community の seed:** MVP では community 作成 API は #310 のため、seed で初期データを投入する。

## 削除対象の既存コード

移行後に削除・更新が必要なファイル:

- `server/src/routes/channels.ts` — チャンネル関連 API（今回は削除せず残す、app.ts からの参照を外す）
- `server/src/routes/messages.ts` — メッセージ API（同上）
- `server/src/persistence/channelRepository.ts` 等 — 旧リポジトリ（今回は削除せず残す）
- `server/src/openapi/registry.ts` — 新 API のエントリを追加し、旧 API のエントリを削除

**今回の方針:** 旧ファイルはコンパイルエラーが出ない範囲で残し、新規ルートを追加する。旧 channels/messages ルートは app.ts から除外する（完全削除は後続 Issue）。

## テスト方針

- repository: InMemory 実装に対して unit test（DB 不要・高速）
- route: `supertest` + `InMemory` リポジトリでインテグレーションテスト
- TDD: テスト先行 → 失敗確認 → 実装の順

## 設計上の判断

1. **Employee モデルは残す**: Worker 管理は別 Issue（#181 等）で実装予定。Employee を Worker として扱う方針は別途確定させる。今回は `Post.author` / `Comment.author` は `String`（worker ID）で十分。
2. **WorldState は JSON カラム**: `workerStates` は Map 型で将来拡張性が必要なため、PostgreSQL の `Json` 型で保持する。
3. **Community 一覧は認証不要**: 公共コミュニティのため誰でも閲覧可能（ADR-0020）。
4. **ホームフィードは購読ベース**: 購読 community の post を新着順で集約。未購読の場合は空配列を返す。
5. **seed データ**: MVP は「technology」「daily」の 2 community を seed で投入する。
