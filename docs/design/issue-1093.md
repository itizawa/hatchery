# 設計書: test: server/src/persistence/inMemoryPushSubscriptionRepository.ts の単体テストを追加する (#1093)

## 1. 目的 / 背景

`inMemoryPushSubscriptionRepository.ts` の `PushSubscriptionRepository` 実装は `upsert` / `delete` / `deleteByEndpointAndUserId` / `deleteByUserId` / `listAll` / `listByUserIds` を持つが、既存の `inMemoryPushSubscriptionRepository.test.ts`（#1088 で追加）は `listByUserIds` のみをカバーしており、他メソッドの分岐が未検証。他リポジトリと同水準のテストカバレッジに揃える。

## 2. スコープ（やること / やらないこと）

- やること: 既存 `inMemoryPushSubscriptionRepository.test.ts` に `upsert` / `delete` / `deleteByEndpointAndUserId` / `deleteByUserId` / `listAll` の `describe` ブロックを追加する。
- やらないこと: `listByUserIds` の既存テスト・実装の変更（既にカバー済みのため対象外）。Prisma 実装（`prismaPushSubscriptionRepository.ts`）側のテストは #1024 で対応済みのため対象外。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `upsert`: 新規 endpoint では新規レコードが作られる／同一 endpoint で 2 回目の `upsert` を呼ぶと id が変わらず userId/p256dh/auth が更新される。
2. `delete`: 存在する endpoint を削除できる／存在しない endpoint を渡してもエラーにならない。
3. `deleteByEndpointAndUserId`: endpoint は一致するが userId が異なる場合は削除されない。
4. `deleteByUserId`: 指定 userId の複数レコードが一括削除され、他ユーザーのレコードは残る。
5. `listAll`: 全レコードを返す。
6. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針

- 既存ファイルの `describe("createInMemoryPushSubscriptionRepository", ...)` 内に、`listByUserIds` と並列の `describe` ブロックとして追加する（ファイル分割はしない）。
- 各テストは `createInMemoryPushSubscriptionRepository()` で毎回新しいインスタンスを生成し、テスト間の状態共有を避ける（既存パターンを踏襲）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server` のみ。既存テストファイルへの追記のみで実装コードの変更はない。

## 6. テスト計画（TDDで書くテスト一覧）

- `upsert`: 新規作成 / 同一 endpoint での更新（id 不変・フィールド更新）
- `delete`: 存在する endpoint の削除 / 存在しない endpoint でもエラーなし
- `deleteByEndpointAndUserId`: userId 不一致で削除されない / 一致すれば削除される
- `deleteByUserId`: 対象 userId の全件削除・他ユーザーは残る
- `listAll`: 全レコード取得

## 7. リスク・未決事項

特になし。純粋なテスト追加のみで既存の挙動・API に影響しない。
