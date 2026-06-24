# 設計書: fetchRecentContext.ts のテスト追加 (#745)

## 1. 目的 / 背景

`server/src/batch/fetchRecentContext.test.ts` は 4 件のみで `recentLog` の内容（中身のフォーマット）を確認するテストが存在しない。
post と comment が混在する場合に `recentLog` の各エントリが期待する形式を持つかどうかが未検証であり、プロンプト品質に影響するバグを見逃すリスクがある。

## 2. スコープ（やること / やらないこと）

- やること: `fetchRecentContext.test.ts` に受け入れ条件の 3 テストを追加する
- やらないこと: `popularPosts` のスコアフィルタのテスト追加（既存 4 件目で済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. post が 1 件あるとき `recentLog` が空配列でなく、各エントリが `formatRecentLog` の出力形式（`[community_id] author: title / text`）を持つことを確認するテスト
2. post と comment が混在するとき `recentLog` の件数が（post 数 + comment 数）に対応し、内容に両方が含まれることを確認するテスト
3. `recentLimit` を指定するとそれ以上の件数は `recentLog` に返さないことを確認するテスト
4. 追加テストが `server/src/batch/fetchRecentContext.test.ts` に記述されており、インメモリリポジトリを使う（DB 接続不要）
5. `pnpm --filter @hatchery/server test` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `formatRecentLog` の出力形式: `[community_id] author: title / text`（title あり）/ `[community_id] author: text`（title なし）
- テスト用リポジトリ: `createInMemoryPostRepository()` / `createInMemoryCommentRepository()`
- comment 作成には `postId` が必要なため、`postRepo.createMany()` の戻り値から ID を取得する

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: server（テストファイルのみ）
- 既存コードの変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| テスト名 | 目的 |
|----------|------|
| post が 1 件あるとき recentLog が空配列でなく formatRecentLog 形式エントリを持つ | AC1 |
| post と comment が混在するとき recentLog の件数と内容が両方含まれる | AC2 |
| recentLimit を指定するとそれ以上の件数は recentLog に返さない | AC3 |

## 7. リスク・未決事項

- なし
