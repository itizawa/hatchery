# 設計書: prismaPushSubscriptionRepository.ts の Web Push 購読永続化ロジックに統合テストを追加する (#1024)

## 1. 目的 / 背景

`server/src/persistence/prismaPushSubscriptionRepository.ts` は Web Push 購読情報を Prisma/PostgreSQL に永続化するアダプタだが、同ディレクトリの 12 個以上の兄弟実装と異なりテストファイルが存在しない。特に `delete()` の P2025 握りつぶし分岐など、テストされていない防御的コードがある。

## 2. スコープ（やること / やらないこと）

**やること**
- `server/src/persistence/prismaPushSubscriptionRepository.test.ts` を新設する
- 全メソッド（`upsert` / `delete` / `deleteByEndpointAndUserId` / `deleteByUserId` / `listAll`）の統合テストを追加する
- `describe.skipIf(!DATABASE_URL)` で実 DB のないCI環境では自動スキップ

**やらないこと**
- Web Push 送信ロジック（`server/src/batch` 配下）のテスト
- 実装コードの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `upsert`: 新規 endpoint が正しく作成される
2. `upsert`: 同一 endpoint への再 upsert で p256dh/auth が上書きされる
3. `delete`: 存在する endpoint を削除できる
4. `delete`: 存在しない endpoint を渡しても例外を投げず正常終了する（P2025 握りつぶし）
5. `deleteByEndpointAndUserId`: 対象の endpoint+userId のみ削除し、他ユーザーの購読は残る
6. `deleteByUserId`: 指定 userId の全購読を削除し、他ユーザーの購読は残る
7. `listAll`: 登録済み購読を正しく返す

## 4. 設計方針

- パターンは `prismaSubscriptionRepository.test.ts` と同じ
- `PushSubscription` は `User` への FK を持つため、`beforeAll` で PrismaClient 接続、`afterEach` で `prisma.user.deleteMany()` を実行（`onDelete: Cascade` により PushSubscription も連鎖削除）
- User fixture はテストごとに `setupFixtures()` で 2 ユーザー作成
- エンドポイント文字列はテスト内でユニークな固定値を使う

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **server**
- 新規ファイル: `server/src/persistence/prismaPushSubscriptionRepository.test.ts`
- 既存コードへの変更: なし

## 6. テスト計画

| # | メソッド | テスト内容 |
|---|----------|------------|
| 1 | upsert | 新規作成でフィールドが正しく保存される |
| 2 | upsert | 同一 endpoint への再 upsert で p256dh/auth が上書きされる |
| 3 | delete | 存在する endpoint を削除できる（listAll で消える） |
| 4 | delete | 存在しない endpoint を渡しても例外を投げない（P2025 握りつぶし） |
| 5 | deleteByEndpointAndUserId | 対象の購読のみ削除し他ユーザーのは残る |
| 6 | deleteByUserId | 指定ユーザーの全購読を削除し他ユーザーのは残る |
| 7 | listAll | 登録済み購読を全件返す |

## 7. リスク・未決事項

- DATABASE_URL 未設定の環境ではスキップされるため、テストはローカル/CI の DB が必要
- 既存実装のバグが発覚した場合は実装修正が必要になるが、現状の実装は正常動作しているとの前提
