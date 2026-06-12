# 設計書: prismaSubscriptionRepository・prismaVoteRepository の実DB結合テストを追加する (#423)

## 1. 目的 / 背景

`prismaSubscriptionRepository.ts` と `prismaVoteRepository.ts` にはインメモリ実装のテストは存在するが、Prisma 実装の結合テストが欠落している。ユーザーの関与点（up/down vote と community 購読）の永続化を実 DB で検証し、スキーマの制約・クエリのリグレッションを検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/persistence/prismaSubscriptionRepository.test.ts` を追加（実 DB 結合テスト）
- `server/src/persistence/prismaVoteRepository.test.ts` を追加（実 DB 結合テスト）
- テストは `describe.skipIf(!DATABASE_URL)` で DB 不在環境をスキップ

**やらないこと:**
- `prismaSubscriptionRepository.ts` / `prismaVoteRepository.ts` の実装変更
- インメモリ実装テストの変更
- 他リポジトリの結合テスト（#422, #424 対象）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

**prismaSubscriptionRepository:**
1. `add`: 購読を追加でき、`listCommunityIdsByUser` に反映される
2. `add`: 既に購読済みの場合は重複しない（upsert）
3. `remove`: 購読を解除でき、一覧から消える
4. `remove`: 存在しない購読の解除は何もしない（エラーなし）
5. `listCommunityIdsByUser`: ユーザーの購読コミュニティ一覧のみ返す（他ユーザーは含まない）
6. `hasSubscription`: 購読済みは true を返す
7. `hasSubscription`: 未購読は false を返す

**prismaVoteRepository:**
8. `findVote`: 未投票は null を返す
9. `findVote`: 投票済みは VoteRecord を返す
10. `vote` 未投票→up: scoreDelta = +1、レコード作成
11. `vote` 未投票→down: scoreDelta = -1、レコード作成
12. `vote` up済み→up: toggle off、scoreDelta = -1、レコード削除
13. `vote` down済み→down: toggle off、scoreDelta = +1、レコード削除
14. `vote` up済み→down: switch、scoreDelta = -2
15. `vote` down済み→up: switch、scoreDelta = +2
16. post と comment の vote は独立して管理される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **DB スキップ方針**: `describe.skipIf(!DATABASE_URL)` で環境変数未設定時はスキップ（#378 パターンと同じ）
- **フィクスチャ**: subscription テストは `User` + `Community` を直接 `prisma.user.create` / `prismaRepo.create` で生成。vote テストは `User` のみ（Vote.targetId は多態参照のため DB FK 不要）
- **クリーンアップ**: `afterEach` で `prisma.user.deleteMany()` + `prisma.community.deleteMany()` を実行（Cascade で Subscription / Vote も削除される）

## 5. 影響範囲 / 既存への変更

- **追加**: `server/src/persistence/prismaSubscriptionRepository.test.ts`
- **追加**: `server/src/persistence/prismaVoteRepository.test.ts`
- 既存ファイルへの変更なし

## 6. テスト計画（TDD で書くテスト一覧）

受け入れ条件 1〜16 をそのままテストとして実装する。

## 7. リスク・未決事項

- DB 不在環境（CI）ではスキップされるため、実 DB での検証は開発者ローカルまたは DB ありの CI でのみ有効
- Vote の targetId に存在しない Post/Comment ID を指定した場合の挙動はアプリケーション層で保証されており、DB FK 制約は無いため テストスコープ外
