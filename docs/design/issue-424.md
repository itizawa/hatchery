# 設計書: prismaWorkerRepository・prismaInvitationLinkRepository・prismaTokenUsageLogRepository の実DB結合テスト (#424)

## 1. 目的 / 背景

`prismaWorkerRepository`・`prismaInvitationLinkRepository`・`prismaTokenUsageLogRepository` に対応する `.test.ts` が無い。
これらは定時バッチの登場メンバー選定・認証導線・コスト可視化の基盤であり、Prisma 実装の挙動（特に論理削除・条件付き更新・集計）を実 DB で検証できていない。
#378 等で確立した Docker Postgres 結合テストパターンで補完し、リグレッションを検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**:
- `prismaWorkerRepository.test.ts`: 全公開メソッド（create / findById / update / listByIds / listBotWorkers / listAllBotWorkers / softDelete / findDeletedById / updateImageUrl）を実 DB で検証
- `prismaInvitationLinkRepository.test.ts`: 全公開メソッド（create / list / findByToken / revoke / markUsed）を実 DB で検証
- `prismaTokenUsageLogRepository.test.ts`: 全公開メソッド（create / findRecent / summarize）を実 DB で検証

**やらないこと**:
- アプリケーションロジックの変更
- community/post/comment 系（#422）・subscription/vote 系（#423）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- Worker: 全公開メソッドを実 DB で検証。`deletedAt` による論理削除フィルタリングを重点カバー
- InvitationLink: token 一意性・revoke・markUsed の条件付き更新（使用済み / revoked / 期限切れ）をカバー
- TokenUsageLog: create（id/occurredAt 付与）・findRecent（降順・limit）・summarize（集計）をカバー
- `DATABASE_URL` 未設定環境では `describe.skipIf(!DATABASE_URL)` でスキップ（CI 互換）
- `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- パターン踏襲: `prismaCommentRepository.test.ts` の構造（`describe.skipIf(!DATABASE_URL)`・`new PrismaClient({ datasources })`・`beforeAll/afterAll` で接続管理・`afterEach` でテーブル清掃）
- Worker テスト: `prisma.worker.deleteMany()` で afterEach 清掃
- InvitationLink テスト: `prisma.invitationLink.deleteMany()` で afterEach 清掃。`createdByUserId` は DB FK なしの String なので任意文字列可
- TokenUsageLog テスト: `prisma.tokenUsageLog.deleteMany()` で afterEach 清掃

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server/` のみ
- 既存実装ファイルへの変更なし（テスト追加のみ）

## 6. テスト計画（TDDで書くテスト一覧）

### prismaWorkerRepository
- create: 正常作成・imageUrl/deletedAt が null
- findById: ヒット / 存在しない id → null / 論理削除済 → null
- update: フィールド更新 / 存在しない id → null / 論理削除済 → null
- listByIds: 指定順保持 / 削除済み除外 / 存在しない id 除外
- listBotWorkers: 削除済み除外 / 空配列
- listAllBotWorkers: 削除済み含む全件
- softDelete: deletedAt セット / findById から外れる / 存在しない → null / 既削除 → null
- findDeletedById: 削除済みヒット / 有効ワーカーヒット / 存在しない → null
- updateImageUrl: imageUrl 更新 / 存在しない → null / 削除済みにも反映

### prismaInvitationLinkRepository
- create: 全フィールド保存 / usedAt・revokedAt が null
- list: 全件 createdAt 降順
- findByToken: ヒット / 未知トークン → null
- revoke: revokedAt セット / 存在しない → null
- markUsed: 有効リンクで usedAt・usedByUserId セット / 使用済み → null / revoked → null / 期限切れ → null

### prismaTokenUsageLogRepository
- create: id・occurredAt 付与 / フィールド正確 / batchRunLogId null 許容
- findRecent: 降順 / limit 効く / 空配列
- summarize: 合計計算 / 空時 0

## 7. リスク・未決事項

- 実 DB 不在環境ではテストがスキップされるため、ローカル/CI での実行には Docker Postgres が必要
- `listByIds` の順序保証: Prisma の `findMany` は `id: { in: ids }` の返却順を保証しないため、Worker 実装と同様に ids の順序で並べ替えている点をテストで確認する
