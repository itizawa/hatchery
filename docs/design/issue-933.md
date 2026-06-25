# 設計書: Subscription.lastViewedAt を追加し購読コミュニティ別未読数 API を実装する (#933)

## 1. 目的 / 背景

`Subscription` テーブルに「最後にコミュニティを訪問した時刻」(`lastViewedAt`) を追加し、未読数取得 API と mark-viewed API を実装する。サイドバーの未読バッジ (#934) ・PostCard の「New」ラベル (#935) の API 基盤となる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `Subscription` テーブルへの `lastViewedAt DateTime?` フィールド追加 + Prisma マイグレーション
- `subscriptionRepository` インターフェースへ 2 メソッド追加
  - `updateLastViewedAt({ userId, communityId, viewedAt })`
  - `listWithUnreadCounts(userId)`
- Prisma 実装 + インメモリ実装
- `PATCH /api/communities/:slug/mark-viewed` エンドポイント
- `GET /api/subscriptions/unread-counts` エンドポイント
- OpenAPI スキーマ登録
- 単体テスト + 統合テスト（TDD）

**やらないこと:**
- フロントエンド実装（#934・#935 で行う）
- クライアントからのタイムスタンプ受け取り（サーバ側で `new Date()` を生成）
- UI 側の 99+ キャップ（API は実数を返すのみ）

## 3. 受け入れ条件（テストに落とせる粒度）

### DB マイグレーション
- `Subscription` テーブルに `lastViewedAt DateTime?`（nullable）が追加され、`prisma migrate` が通る
- 既存レコードは `lastViewedAt = null`（マイグレーション後も既存データが保持される）

### subscriptionRepository
- `updateLastViewedAt({ userId, communityId, viewedAt })` が実装される
  - 存在しない Subscription（未購読）に対して呼んだ場合は no-op（エラーを throw しない）
- `listWithUnreadCounts(userId)` が実装される
  - `lastViewedAt` 以降（`createdAt > lastViewedAt`）に作成された Post 件数を `unreadCount` として返す
  - `lastViewedAt` が null のコミュニティは `unreadCount = 0` を返す
  - reveal フィルタ（`createdAt <= now`）を適用する

### API エンドポイント
- `PATCH /api/communities/:slug/mark-viewed`（認証必須）
  - 購読済み: `lastViewedAt` を現在時刻に更新し 204 を返す
  - 未購読: 403 を返す
  - コミュニティ不在: 404 を返す
- `GET /api/subscriptions/unread-counts`（認証必須）
  - レスポンス: `{ unread_counts: [{ community_id, community_slug, unread_count }] }`
  - 購読コミュニティなし: `{ unread_counts: [] }` を返す
- OpenAPI スキーマが生成される

## 4. 設計方針

### データ設計
- `Subscription` に `lastViewedAt DateTime?` を nullable で追加
- サーバ側 `new Date()` で生成（クライアントからタイムスタンプ受け取らない）

### `listWithUnreadCounts` の実装方針
- Prisma の `groupBy` + `_count` + `where: { createdAt: { gt: lastViewedAt, lte: now } }` でコミュニティ別に集計
- `lastViewedAt` が null のコミュニティは `unreadCount = 0` 固定
- `communitySlug` を返すため `include: { community: { select: { slug: true } } }` で JOIN

### ルーティング
- `PATCH /api/communities/:slug/mark-viewed` は `communities.ts` に追加（既存 subscribe/unsubscribe と同ファイル）
- `GET /api/subscriptions/unread-counts` は新ファイル `server/src/routes/subscriptions.ts` に追加
- `app.ts` に `/api/subscriptions` → `createSubscriptionsRouter` をマウント

### OpenAPI
- `registerSubscriptions` 関数を `server/src/openapi/registrations/registerSubscriptions.ts` に追加
- `UnreadCountsResponseSchema` を `common/src/domain/subscription/subscription.ts` に追加
- `registry.ts` で `registerSubscriptions` を呼ぶ

## 5. 影響範囲 / 既存への変更

- **server**: `prisma/schema.prisma`・`persistence/subscriptionRepository.ts`・`persistence/prismaSubscriptionRepository.ts`・`routes/communities.ts`・新規 `routes/subscriptions.ts`・`app.ts`・`openapi/registry.ts`・新規 `openapi/registrations/registerSubscriptions.ts`
- **common**: `domain/subscription/subscription.ts`（`UnreadCountsResponseSchema` 追加）
- **テスト**: `persistence/subscriptionRepository.test.ts`・新規 `persistence/prismaSubscriptionRepository.test.ts`（メソッド追加）・新規 `routes/subscriptions.test.ts`・`routes/communities.test.ts`（mark-viewed 追加）

## 6. テスト計画

### `subscriptionRepository.test.ts`（ユニット・インメモリ実装）
- `updateLastViewedAt`: 更新できる / 未購読に対して no-op
- `listWithUnreadCounts`: lastViewedAt=null → unreadCount=0 / 未読あり → 正しい件数 / 時刻より前のポストは含まない

### `prismaSubscriptionRepository.test.ts`（統合・DATABASE_URL必須）
- `updateLastViewedAt` / `listWithUnreadCounts` の同等ケース

### `routes/communities.test.ts`（統合）
- `PATCH /:slug/mark-viewed`: 購読済み→204 / 未購読→403 / コミュニティ不在→404 / 未認証→401

### `routes/subscriptions.test.ts`（統合）
- `GET /api/subscriptions/unread-counts`: 認証済み→200+unread_counts / 購読なし→空配列 / 未認証→401

## 7. リスク・未決事項

- `listWithUnreadCounts` のインメモリ実装では Post テーブルへのアクセスが必要だが、`subscriptionRepository` は Post に依存しない。インメモリ実装ではテスト用 Post データを別途注入する必要がある → Post リストをクロージャで保持するか、または簡易的に固定 `unreadCount = 0` を返す設計にする。
  - **決定**: インメモリ実装はテスト用途でありルートテストで注入する。`listWithUnreadCounts` の第 2 引数として `posts` を受け取る設計は複雑すぎる。代わりに、インメモリ実装では `lastViewedAt` を管理しつつ unreadCount は常に 0 を返す（機能テストは Prisma 統合テストで担保する）。ただしルートテストでは mock 関数で制御する。
  - **最終決定**: インターフェース `listWithUnreadCounts` はシンプルにユーザーIDだけ受け取る。インメモリ実装は `unreadCount: 0` 固定で返す（DB 依存のロジックは Prisma 実装のみ）。
