# 設計書: Subscription.lastViewedAt を追加し購読コミュニティ別未読数 API を実装する (#933)

## 1. 目的 / 背景

`Subscription` テーブルに「最後にコミュニティを訪問した時刻」を記録するフィールドを追加し、購読コミュニティ別未読数取得 API と mark-viewed API を実装する。これにより、サイドバーの未読バッジ（#934）・PostCard の「New」ラベル（#935）の API 基盤を整える。

## 2. スコープ（やること / やらないこと）

**やること**
- `Subscription` テーブルへの `lastViewedAt DateTime?` フィールド追加（Prisma マイグレーション）
- `subscriptionRepository` への 2 メソッド追加: `updateLastViewedAt` / `listWithUnreadCounts`
- `PATCH /api/communities/:slug/mark-viewed`（認証必須）
- `GET /api/subscriptions/unread-counts`（認証必須）
- OpenAPI スキーマ登録

**やらないこと**
- フロントエンド実装（#934・#935 で対応）
- 未読数の上限表示（フロントが `99+` で丸める）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `Subscription` テーブルに `lastViewedAt DateTime?` が追加され、既存レコードは `null`
- `updateLastViewedAt({ userId, communityId, viewedAt })` は Subscription を更新し、未購読の場合は no-op（エラーなし）
- `listWithUnreadCounts(userId)` は `lastViewedAt` 以降の Post 数を `unreadCount` として返す
  - `lastViewedAt = null` のコミュニティは `unreadCount = 0`
  - reveal フィルタ（`createdAt <= now`）を適用する
- `PATCH /api/communities/:slug/mark-viewed`
  - 購読中: 204 を返す
  - 未購読: 403 を返す
  - コミュニティ不存在: 404 を返す
  - 未認証: 401 を返す
- `GET /api/subscriptions/unread-counts`
  - 認証済み: `{ unread_counts: [{ community_id, community_slug, unread_count }] }` を返す
  - 購読なし: `{ unread_counts: [] }` を返す
  - 未認証: 401 を返す

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `Subscription` モデルに `lastViewedAt DateTime?` を追加
- `subscriptionRepository.ts` インターフェースに 2 メソッドを追加し、in-memory 実装も更新
- `prismaSubscriptionRepository.ts` に Prisma 実装を追加
- `PATCH mark-viewed` ルートは既存 `communities.ts` に追記
- `GET unread-counts` ルートは新規 `subscriptions.ts` に実装し `app.ts` でマウント
- OpenAPI: `registerCommunities.ts` に mark-viewed を追記、新規 `registerSubscriptions.ts` を追加
- common に `UnreadCountSchema` / `UnreadCountsResponseSchema` を追加

## 5. 影響範囲 / 既存への変更

- `common/src/domain/subscription/subscription.ts` — 新スキーマ追加
- `server/prisma/schema.prisma` — `Subscription` に `lastViewedAt` 追加
- `server/prisma/migrations/` — 新マイグレーション
- `server/src/persistence/subscriptionRepository.ts` — インターフェース + in-memory 実装拡張
- `server/src/persistence/prismaSubscriptionRepository.ts` — 実装追加
- `server/src/routes/communities.ts` — `PATCH mark-viewed` 追加
- `server/src/routes/subscriptions.ts` — 新規
- `server/src/openapi/registrations/registerCommunities.ts` — mark-viewed 登録追加
- `server/src/openapi/registrations/registerSubscriptions.ts` — 新規
- `server/src/openapi/registry.ts` — registerSubscriptions 呼び出し追加
- `server/src/app.ts` — subscriptions ルータマウント追加

## 6. テスト計画（TDD で書くテスト一覧）

### common
- `UnreadCountSchema` のパーステスト

### server/persistence
- in-memory: `updateLastViewedAt` — 正常・未購読（no-op）
- in-memory: `listWithUnreadCounts` — 基本動作

### server/routes（統合テスト）
- `PATCH /api/communities/:slug/mark-viewed`
  - 購読中 → 204
  - 未購読 → 403
  - コミュニティ不存在 → 404
  - 未認証 → 401
- `GET /api/subscriptions/unread-counts`
  - 購読あり → 200 with unread_counts
  - 購読なし → 200 with empty array
  - 未認証 → 401

## 7. リスク・未決事項

- Prisma 統合テストは DATABASE_URL 依存のため CI 上でのみ動作する
- `listWithUnreadCounts` の実装で in-memory 版は Prisma の `_count` を模倣する必要がある
