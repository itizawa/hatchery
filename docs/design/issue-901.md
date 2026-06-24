# 設計書: ADR-0034 の postBatch/commentBatch 移行を完了し communityBatchIndex.ts を削除する (#901)

## 1. 目的 / 背景

`communityBatchIndex.ts` には `@deprecated` コメントが存在し、ADR-0034 の指示「Cloud Scheduler から外した後にコードを削除する」が未実行のままになっていた。`postBatchIndex.ts`（#672）と `commentBatchIndex.ts`（#673）は実装済みであるため、技術的負債を解消して deprecated コードを完全に削除する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/batch/communityBatchIndex.ts` と `communityBatchIndex.test.ts` を削除する
- `server/src/batch/runCommunityBatch.ts` と `runCommunityBatch.test.ts` を削除する（communityBatchIndex 削除後に dead code となるため）
- `server/package.json` の `"batch"` スクリプトを削除し、`"batch:comment"` スクリプトを追加する
- `docs/cloud-run-batch-setup.md` を更新し、Cloud Run Job のコマンドを `postBatchIndex.js` / `commentBatchIndex.js` に切り替える手順を記載する
- `env.ts` の stale コメント（`runCommunityBatch` への言及）を更新する

**やらないこと:**
- 新たなバッチ設計変更（ADR-0034 範囲外）
- `env.ts` の `batchDripWindowMs` / `batchPostMin` / `batchPostMax` / `batchCommentMin` / `batchCommentMax` の削除（使用箇所は communityBatchIndex.ts のみだが、env のリファクタは別 Issue とする）
- Cloud Scheduler の設定変更（手順書更新のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `communityBatchIndex.ts` / `communityBatchIndex.test.ts` が存在しない
2. `runCommunityBatch.ts` / `runCommunityBatch.test.ts` が存在しない
3. `server/package.json` に `"batch": "tsx src/batch/communityBatchIndex.ts"` が存在しない
4. `server/package.json` に `"batch:post"` と `"batch:comment"` が両方存在する
5. `docs/cloud-run-batch-setup.md` が `communityBatchIndex.js` への参照を持たない
6. `pnpm --filter @hatchery/server test` が全て緑
7. `pnpm --filter @hatchery/server lint` が通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `runCommunityBatch.ts` は `communityBatchIndex.ts` からのみ利用されているため、両ファイルを一緒に削除する
- post バッチ（`runPostBatch.ts` / `postBatchIndex.ts`）と comment バッチ（`runCommentBatch.ts` / `commentBatchIndex.ts`）が既に実装済みであり、機能を完全に代替している
- Cloud Run Job は 2 ジョブ構成とする: post 用（`hatchery-batch-post`）と comment 用（`hatchery-batch-comment`）

## 5. 影響範囲 / 既存への変更

| 対象 | 変更種別 | 内容 |
|------|---------|------|
| `server/src/batch/communityBatchIndex.ts` | 削除 | deprecated エントリポイント |
| `server/src/batch/communityBatchIndex.test.ts` | 削除 | 上記のテスト |
| `server/src/batch/runCommunityBatch.ts` | 削除 | 旧モノリシックバッチロジック（dead code） |
| `server/src/batch/runCommunityBatch.test.ts` | 削除 | 上記のテスト |
| `server/package.json` | 変更 | `"batch"` 削除・`"batch:comment"` 追加 |
| `docs/cloud-run-batch-setup.md` | 変更 | Job コマンドを post/comment 2 ジョブに更新 |
| `server/src/config/env.ts` | 変更 | stale コメント更新 |

## 6. テスト計画（TDDで書くテスト一覧）

今回は削除タスクのため、新規テストは不要。以下の既存テストが全て緑であることを確認する:
- `postBatchIndex.test.ts` — post バッチ CLI エントリのテスト
- `commentBatchIndex.test.ts` — comment バッチ CLI エントリのテスト
- `runPostBatch.test.ts` — post バッチロジックのテスト
- `runCommentBatch.test.ts` — comment バッチロジックのテスト

## 7. リスク・未決事項

- `env.ts` の `batchDripWindowMs` / `batchPostMin` / `batchPostMax` 等は communityBatchIndex.ts でしか使われていないが、コンパイルエラーにはならないため今回は残す（別 Issue でリファクタ可能）
- Cloud Run Job の実際の切り替え（gcloud コマンド実行）は本番運用者が手順書に従って実施する（本 Issue は手順書更新のみ）
