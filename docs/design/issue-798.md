# 設計書: 定時バッチ完了時に購読ユーザーへ Web Push 通知を送る (#798)

## 1. 目的 / 背景

定時バッチ（`runPostBatch`）で新着コンテンツが生成されたタイミングで、
購読しているユーザーに Web Push 通知を届け、アプリへの再訪を促すリテンションループを作る。
前提: #797（PWA 対応 / Service Worker 追加）は完了済み。

## 2. スコープ（やること / やらないこと）

### やること
- PushSubscription Prisma モデルの追加と DB マイグレーション
- `POST /api/push/subscribe`・`DELETE /api/push/subscribe` エンドポイント（認証必須）
- `pushNotificationService.ts` による VAPID + web-push 送信
- `postBatchIndex.ts` 成功後フックで全購読者に通知（fire-and-forget）
- vite-plugin-pwa を `injectManifest` モードに切り替えてカスタム SW に push イベントリスナーを追加
- `client/src/api/push.ts` に `subscribePush()` / `unsubscribePush()`
- `PushSubscribeButton` コンポーネント + AccountScene への組み込み
- iOS 判定メッセージ表示

### やらないこと
- コミュニティ別購読（全体通知のみ）
- 通知頻度設定・サイレント時間帯
- バックグラウンド同期

## 3. 受け入れ条件（テストに落とせる粒度で）

1. `PushSubscriptionSchema` が endpoint（URL, max 2048）/ p256dh（max 512）/ auth（max 128）を持つ
2. `PushPayloadSchema` が title（max 100）/ body（max 300）/ url（max 512）を持つ
3. Prisma に PushSubscription モデル（id/userId/endpoint/p256dh/auth/createdAt）が追加される
4. `POST /api/push/subscribe` が認証済みユーザーの購読を DB に保存する
5. `DELETE /api/push/subscribe` が購読を DB から削除する
6. `pushNotificationService.sendToAllSubscribers` が全購読者に push 送信する（失敗は無視）
7. postBatchIndex が posts > 0 のとき pushNotificationService を呼ぶ（fire-and-forget）
8. SW に `push` イベントリスナーがあり `showNotification()` を呼ぶ
9. SW に `notificationclick` リスナーがあり `clients.openWindow()` を呼ぶ
10. `PushSubscribeButton` が未許可時に許可ボタン、許可済み時に解除ボタンを表示する
11. iOS 判定時に「ホーム画面に追加後に有効になります」メッセージを表示する

## 4. 設計方針

### アーキテクチャ
```
common: PushSubscriptionSchema / PushPayloadSchema (Zod)
  ↓ (共有型)
server: pushSubscriptionRepository (Prisma CRUD)
        pushNotificationService (web-push VAPID送信)
        routes/pushSubscriptions.ts (REST API)
        postBatchIndex.ts (バッチ成功後フック)
  ↑ (OpenAPI → 型生成)
client: api/push.ts (openapi-fetch クライアント)
        components/PushSubscribeButton.tsx (UI)
        sw.ts (Service Worker: push/notificationclick)
```

### Service Worker
現在の `generateSW` モード → `injectManifest` モードへ切り替え。
`client/src/sw.ts` を作成し workbox-precaching + workbox-routing で既存の
オフラインキャッシュ動作を維持しつつ、push/notificationclick イベントを追加する。

### VAPID 環境変数
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`: server 側（省略可）
- `VITE_VAPID_PUBLIC_KEY`: client 側（`pushManager.subscribe` の `applicationServerKey`）

生成コマンド:
```bash
node -e "const webpush=require('web-push');console.log(JSON.stringify(webpush.generateVAPIDKeys()))"
```

### push endpoint の構造
- `POST /api/push/subscribe` body: `{ endpoint, p256dh, auth }`
- `DELETE /api/push/subscribe` body: `{ endpoint }`

endpoint が一意制約（userId+endpoint ではなく endpoint のみ unique）なため、
upsert パターン（既存削除 → 新規作成）で同一エンドポイントの更新に対応する。

## 5. 影響範囲

| ワークスペース | 変更内容 |
|---|---|
| common | domain/pushSubscription/ を新設 |
| server | prisma/schema.prisma, env.ts, app.ts, persistence/*, services/*, routes/*, openapi/*, batch/postBatchIndex.ts |
| client | vite.config.ts, src/sw.ts, src/api/push.ts, src/components/PushSubscribeButton.tsx, src/routes/AccountScene.tsx |

## 6. テスト計画

- common: PushSubscriptionSchema / PushPayloadSchema のバリデーション（正常・異常）
- server: prismaPushSubscriptionRepository のユニットテスト（Prisma モック）
- server: pushNotificationService のユニットテスト（web-push モック）
- server: pushSubscriptions ルートの integration test（supertest）
- client: PushSubscribeButton のレンダリングテスト（RTL）

## 7. リスク・未決事項

- VAPID キーが未設定の場合は push 送信をスキップ（`pushNotificationService` が undefined のとき）
- 本番では VAPID キーを `.env` で管理。`.env.example` に項目を追加する
- iOS Safari は PWA インストール後のみ Web Push が有効（ユーザーへの案内が必要）
