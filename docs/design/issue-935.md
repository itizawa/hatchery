# 設計書: ホームフィードの PostCard に購読コミュニティの新着投稿を示す「New」ラベルを表示する (#935)

## 1. 目的 / 背景

#933 で追加された `Subscription.lastViewedAt` を活用し、ホームフィード・コミュニティフィードの PostCard で「前回訪問後に投稿された記事」を視覚的に区別できるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- `GET /api/subscriptions/unread-counts` レスポンスに `last_viewed_at` フィールドを追加
- PostCard に `isNew` prop を追加し、`true` のとき「New」Chip を表示
- HomeFeedScene で `useUnreadCountsForNewLabel` を使い、各 PostCard に `isNew` を渡す
- CommunityScene（CommunityContent）でも同様に `isNew` を渡す

### やらないこと
- New ラベルのアニメーション（表示/非表示のみ）
- New ラベルの件数カウント表示
- サイドバーバッジとの連動（それは #934）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/subscriptions/unread-counts` レスポンスに `last_viewed_at: string | null` が含まれる
2. PostCard に `isNew={true}` を渡すと「New」テキストを持つ Chip が表示される
3. PostCard に `isNew={false}` または `isNew` 未指定のときは「New」Chip が表示されない
4. HomeFeedScene: ログイン済み + 購読中 + `post.created_at > lastViewedAt` なら `isNew=true`
5. HomeFeedScene: 未購読コミュニティの投稿には `isNew=false`
6. HomeFeedScene: 未ログインでは `isNew=false`（unread-counts を呼ばない）
7. `lastViewedAt` が null のコミュニティ投稿には `isNew=false`
8. サーバ: `last_viewed_at` が `unread_counts` 配列の各アイテムに含まれる

## 4. 設計方針

### API 拡張
`SubscriptionWithUnreadCount` インターフェースに `lastViewedAt: Date | null` を追加し、
`subscriptions.ts` ルートでシリアライズして返す。
Zod スキーマ (`UnreadCountItemSchema`) に `last_viewed_at: z.string().nullable()` を追加することで
OpenAPI 定義・クライアント型も自動で更新される。

### クライアント側の `isNew` 判定
- `useUnreadCountsForNewLabel({ enabled: boolean })`: `useQuery`（非 Suspense）で実装。
  未認証時は `enabled: false` にしてリクエストを送らない。
- `HomeFeedScene` / `CommunityScene` で `Map<community_id, last_viewed_at>` を構築し、
  各 PostCard に `isNew` を prop として渡す。

### PostCard 拡張
`isNew?: boolean` prop を追加。`true` のときタイトル右に
MUI `Chip` size="small"（`#1164A3`・label="New"）を表示。角丸は 8px 以下（規約準拠）。

## 5. 影響範囲

- `common`: `subscription.ts` — `UnreadCountItemSchema` に `last_viewed_at` 追加
- `server`: `subscriptionRepository.ts`, `prismaSubscriptionRepository.ts`, `routes/subscriptions.ts`, `subscriptions.test.ts`, `openapi/registrations/registerSubscriptions.ts`（スキーマ変更で自動反映、登録コード変更不要）
- `client`: `api/subscriptions.ts`, `components/PostCard.tsx`, `components/PostCard.test.tsx`, `routes/HomeFeedScene.tsx`, `routes/CommunityScene.tsx`

## 6. テスト計画

### server
- `GET /api/subscriptions/unread-counts` のレスポンスに `last_viewed_at` が含まれることを検証

### client (PostCard)
- `isNew={true}` → "New" Chip が表示される
- `isNew={false}` → "New" Chip が表示されない
- `isNew` 未指定 → "New" Chip が表示されない

## 7. リスク・未決事項

- `MarkViewedEffect` が即座に `markViewed()` を呼ぶため、CommunityScene では "New" ラベルがほぼ瞬時に消える。これは意図した挙動（訪問=既読）。
- `useUnreadCountsForNewLabel` は `useQuery`（非 Suspense）のため、データ取得中は `undefined` を返す。その間は `isNew=false` として扱う（ラベル非表示）。
