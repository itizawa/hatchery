# 設計書: 旧 goal 系バッチ（planningBatch / researcherBatch / githubIssueTool ほか）を削除する（#330 の補完・ADR-0016 廃止後処理） (#335)

## 1. 目的 / 背景

ADR-0023（成果物生成構想の中止と「純粋な会話観察」への簡素化）により、ADR-0016（channel goal）・ADR-0017（Agent SDK リサーチャー）は Superseded となり、#332 / #333（成果物生成）は中止・クローズされた。これにより channel 時代の goal 系バッチコードは宙に浮いており、ADR-0023 §(a) で「`planningBatch` / `researcherBatch` / `githubIssueTool` 等は #335 で削除する」と明記されている。「#333 完了後に着手」という依存条件は #333 中止により解除済み（移植元として温存する必要が消えた）。

本 Issue は #330（旧 Channel/Message/Task/ChannelMembership 全削除）の補完として、goal 系バッチコードを一掃し、`server/src/batch/` を Community ベースの新実装だけにする。

## 2. スコープ（やること / やらないこと）

### やること
- Issue 本文の削除対象表のうち、現時点で残っているファイルを削除する。
  - `server/src/batch/githubIssueTool.ts`
  - `server/src/batch/githubIssueTool.test.ts`
- 上記削除に伴い不要化する依存 `@octokit/rest` を `server/package.json` から除去する（goal 系バッチ専用で他に利用箇所がない）。

### やらないこと（既に完了済み / スコープ外）
- 表中の他ファイル（`planningBatch.*` / `researcherBatch.*` / `researcherIndex.ts` / `rosterMessageGenerator.*` / `runAiMessageBatch.goal.test.ts`）は **#330 で削除済み**で現状存在しない。二重削除しない。
- `batch:researcher` script は既に `server/package.json` から削除済み。
- `runSummaryBatch.ts` / `summaryIndex.ts` / `schedule.ts`、`common/src/domain/channel/`、`server/src/routes/planning-issues.ts` は本 Issue では触らない。
- `docs/design/issue-285.md` 等の歴史的設計ドキュメント、ADR-0023 本文の `githubIssueTool` 記述は履歴として残す。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `server/src/batch/githubIssueTool.ts` と `server/src/batch/githubIssueTool.test.ts` が存在しない。
2. `grep -rn "planningBatch\|researcherBatch\|githubIssueTool\|rosterMessageGenerator" server/src/ --include="*.ts"` がヒットしない（旧ファイルへの import / 参照が残っていない）。
3. `server/package.json` に `batch:researcher` script が無く、`@octokit/rest` 依存が無い。
4. `pnpm turbo run build test lint` がすべて緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

純粋な削除タスク。`githubIssueTool.ts` はリポジトリ内のどこからも import されていない（`grep` 上、自身のテストからのみ参照）。Community バッチ（`runCommunityBatch.ts` / `communityBatchIndex.ts`）は github / issue / artifact を一切参照しないことを確認済み。よってビルド・型・実行時の依存を壊さずファイル削除のみで完結する。

`@octokit/rest` は `githubIssueTool.ts` でのみ使用されていたため、削除後は不要依存となる。`server/package.json` から除去し lockfile を更新する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- `server/` — `src/batch/githubIssueTool.ts` / `githubIssueTool.test.ts` 削除、`package.json` から `@octokit/rest` 除去。
- `docs/` — 本設計書を追加。
- `client` / `common` — 影響なし。

## 6. テスト計画（TDDで書くテスト一覧）

削除タスクのため新規プロダクトコードは無い。受け入れ条件の検証は「リポジトリ規約テスト（grep 不在）」と既存テストスイートの緑維持で行う。

- リポジトリ規約テスト（`tests/`）に「旧 goal 系バッチの識別子が `server/src/` に残っていない」ことを保証するガードテストを追加する。
  - まず削除前にテストを書き、失敗（識別子が残存）を確認 → コミット → 削除で緑にする TDD サイクルを踏む。
- 既存の `pnpm turbo run build test lint` 全緑を最終確認。

## 7. リスク・未決事項

- `@octokit/rest` 除去で lockfile（pnpm-lock.yaml）が変わる。他ワークスペースが推移的に依存していないことを確認する。
- 表中の大半が #330 で削除済みのため、本 Issue の実差分は githubIssueTool 2 ファイル + package.json + ガードテストに限られる。スコープを表に固定し他へ波及させない。
