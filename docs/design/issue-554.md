# Issue #554 設計書: Vote テーブルに createdAt インデックスを追加する

## 背景・目的

定時バッチのコミュニティ選定（ADR-0030）では `netScoresByCommunitySince` が直近 7 日の Vote を `WHERE v."createdAt" >= ${since}` でフィルタする。
現状の Vote テーブルには `@@index([postId])` と `@@index([commentId])` しかなく、`createdAt` にインデックスがないためシーケンシャルスキャンが発生する。

## Issue 原文との差異（設計判断）

Issue 原文では `@@index([targetType, createdAt])` の追加を求めているが、`targetType` カラムは #453（Exclusive Arc 移行）で既に削除されている。
現行スキーマの等価最適化として `@@index([createdAt])` を追加する。

`netScoresByCommunitySince` の SQL は:
```sql
WHERE v."postId" IS NOT NULL AND v."createdAt" >= $since
UNION ALL
WHERE v."commentId" IS NOT NULL AND v."createdAt" >= $since
```
という 2 ブランチの UNION ALL であり、`createdAt` の単一インデックスで両ブランチの期間フィルタを効かせられる。

## 受け入れ条件の実装方針

1. `server/prisma/schema.prisma` の `Vote` モデルに `@@index([createdAt])` を追加
2. Prisma マイグレーションファイルを生成・コミット
3. 既存テストが全て通過すること（スキーマ変更のみでロジック変更なし）

## 実装範囲

- `server/prisma/schema.prisma`: `@@index([createdAt])` 追加
- `server/prisma/migrations/20260616000000_vote_add_created_at_index/migration.sql`: 自動生成
- ロジック・クエリの変更なし
- e2e ユースケースの変更なし（ユーザー可視の振る舞いは変わらない）

## スキーマ変更後の Vote モデル

```prisma
model Vote {
  id        String        @id @default(uuid(7))
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  postId    String?
  post      Post?         @relation(fields: [postId], references: [id], onDelete: Cascade)
  commentId String?
  comment   Comment?      @relation(fields: [commentId], references: [id], onDelete: Cascade)
  direction VoteDirection @default(up)
  createdAt DateTime      @default(now())

  @@unique([userId, postId])
  @@unique([userId, commentId])
  @@index([postId])
  @@index([commentId])
  @@index([createdAt])   // 追加: netScoresByCommunitySince の期間フィルタ最適化
}
```
