# 設計書: プッシュ通知をコミュニティ単位でON/OFFできるようにする (#1088)

## 1. 目的 / 背景

Web Push 通知は現在デバイス単位のグローバル ON/OFF（`PushSubscribeButton.tsx` → `PushSubscription`）しかなく、購読している community 横断で一律に届く。community 数が増えるほど「気になる community だけ通知が欲しい」という体験のギャップが広がり、通知疲れによる全面オフを招く。

本 Issue は、ユーザーが購読している community（`Subscription` レコード）ごとに通知の ON/OFF を個別設定できるようにし、定時バッチ完了時の push 送信をその設定で絞り込む。

## 2. スコープ（やること / やらないこと）

**やること**

- `Subscription`（community 購読の join レコード）に `notifyEnabled` フィールドを追加する。
- community 単位で `notifyEnabled` を更新する API（`PATCH /api/communities/{slug}/subscription`）を追加する。
- post バッチ完了時の push 送信を、投稿があった community で `notifyEnabled = true` のユーザーにのみ絞り込む。
- community 詳細画面（購読ボタン周辺）に通知 ON/OFF トグルを追加する。

**やらないこと（スコープ外）**

- 通知の種類（新着投稿 / コメント等）ごとの細分化。
- comment バッチ側の push 通知（現状 comment バッチは push を送っていないため対象外）。
- デバイス単位のグローバル ON/OFF（`PushSubscribeButton.tsx`）の変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `common`: `SubscriptionSchema` に `notify_enabled: z.boolean()` を追加し、パーステストを追加する。`SubscriptionStatusSchema` に `notify_enabled: z.boolean()` を追加する。`PATCH` リクエストボディ用に `UpdateSubscriptionNotifyEnabledBodySchema` を追加する。
2. `server`:
   - `server/prisma/schema.prisma` の `Subscription` モデルに `notifyEnabled Boolean @default(true)` を追加し、対応する migration を追加する。
   - `SubscriptionRepository` に `notifyEnabled` を含む `find`・`updateNotifyEnabled`・`listNotifiableUserIds` を追加し、in-memory / Prisma 両実装 + 単体テストを追加する。
   - `GET /api/communities/{slug}/subscription` が `notify_enabled` を含めて返す（未認証・未購読時は `true`）。
   - `PATCH /api/communities/{slug}/subscription`（認証必須）を追加し、未購読なら 403、community 不在なら 404、ボディ不正なら 400 を返す。
   - `PushSubscriptionRepository` に `listByUserIds` を追加する。
   - `pushNotificationService` の送信対象を「全件」から「指定 userId 一覧」に変更し（`sendToUsers`）、`postBatchIndex.ts` が投稿のあった community の `notifyEnabled=true` ユーザーのみに絞り込んで呼び出す。
   - OpenAPI に新エンドポイントを登録し、`registry.snapshot.test.ts` の baseline を再生成する。
3. `client`:
   - `client/src/api/subscriptions.ts` に `updateSubscriptionNotifyEnabled` / `useUpdateNotifyEnabled` を追加する。
   - `CommunityScene.tsx` の購読ボタン付近（ヘッダーアクション）に、購読中のみ表示される通知 ON/OFF トグル（`NotifyToggle` コンポーネント）を追加する。
4. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **データモデル**: `Subscription`（`(userId, communityId)` 複合主キー）は既に「このユーザーがこの community を購読しているか」を表す唯一のレコードなので、そこに `notifyEnabled: Boolean @default(true)` を追加するのが最小差分。新しい join テーブルは作らない。
- **API 設計**: 既存の `GET /api/communities/{slug}/subscription`（購読状態取得）と対になる `PATCH` を同じパスに追加する。`mark-viewed` と同様「未購読なら 403」というガードを踏襲する。
- **push 送信の絞り込み**: `postBatchIndex.ts` の `runPostBatchCli` は `result.posts`（今回生成された投稿）から `communityId` の集合を作り、`subscriptionRepo.listNotifiableUserIds(communityIds)` で notify 対象 userId を取得、`pushNotificationService.sendToUsers(payload, userIds)` で `PushSubscriptionRepository.listByUserIds` により該当ユーザーの端末にのみ送信する。既存の `sendToAllSubscribers` は呼び出し元が 1 箇所のみのため置き換える（後方互換の維持は不要）。
- **client**: `SubscriptionStatus` の `children(subscribed)` シグネチャは変えず、`communitySubscriptionQueryKey` を再利用する `NotifyToggle` 用の内部コンポーネントを追加し、TanStack Query のキャッシュ共有でネットワーク往復を増やさない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `common`: `domain/subscription/subscription.ts` とそのテスト。
- `server`: `prisma/schema.prisma` + migration、`persistence/subscriptionRepository.ts`（+ in-memory/Prisma実装）、`persistence/pushSubscriptionRepository.ts`（+ 実装）、`routes/communities.ts`、`services/pushNotificationService.ts`、`batch/postBatchIndex.ts`、`openapi/registrations/registerSubscriptions.ts`、`openapi/__fixtures__/openapi.baseline.json`。
- `client`: `api/subscriptions.ts`、`routes/CommunityScene.tsx`、新規 `components/NotifyToggle.tsx`。
- `e2e`: `e2e/community/usecases.md`（UC-COMM-31 追加）、`e2e/usecases.md`（索引更新）。

## 6. テスト計画（TDDで書くテスト一覧）

- `common/src/domain/subscription/subscription.test.ts`: `notify_enabled` のパーステスト（true/false/欠落時の扱い）。
- `server/src/persistence/subscriptionRepository.test.ts`: `updateNotifyEnabled`・`listNotifiableUserIds`・`find` の in-memory テスト。
- `server/src/persistence/prismaSubscriptionRepository.test.ts`: 同上の Prisma 実装テスト。
- `server/src/persistence/prismaPushSubscriptionRepository.test.ts` / in-memory: `listByUserIds` のテスト。
- `server/src/services/pushNotificationService.test.ts`: `sendToUsers` が指定 userId のみに送信することのテスト。
- `server/src/routes/communities.test.ts`: `GET`/`PATCH /:slug/subscription` の notify_enabled 関連テスト（未購読403・不正ボディ400・成功204等）。
- `server/src/batch/postBatchIndex.test.ts`: notify 対象を絞り込んで送信することのテスト。
- `client/src/api/subscriptions.test.ts`: `updateSubscriptionNotifyEnabled` のテスト。
- `client/src/components/NotifyToggle.test.tsx`: トグル表示・クリックでコールバックが呼ばれることのテスト。

## 7. リスク・未決事項

- 既存の `GET /subscription` レスポンス契約（`{ subscribed }`）に `notify_enabled` を追加するため、OpenAPI baseline fixture の再生成が必要（意図的な契約変更）。
- `pushNotificationService.sendToAllSubscribers` を `sendToUsers` に置き換える破壊的変更だが、呼び出し元は `postBatchIndex.ts` の 1 箇所のみのため影響は閉じている。
