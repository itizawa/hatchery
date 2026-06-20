# 設計書: 定時バッチを全コミュニティ対象のタスクキュー方式に変更する (#671)

## 1. 目的 / 背景

ADR-0030（#486）で「1 定時 = vote 重み付きランダムで 1 コミュニティのみ生成」へ変更した。
目的は API コストをコミュニティ数から切り離すことだったが、
「コミュニティが定時ごとに必ずしも更新されない（観察エンタメとして更新頻度が不足する）」課題が生じた。

本 Issue では、全コミュニティを毎定時に更新する方式へ変更し、ADR-0030 を supersede する。

## 2. スコープ（やること / やらないこと）

### やること
- `runCommunityBatch` を全コミュニティ対象に変更（`Promise.allSettled` による並列処理）
- `selectOneCommunity` および vote 重み付き選定ロジックを `runCommunityBatch.ts` から削除
- `voteRepo` を `RunCommunityBatchDeps` から削除
- `BatchRunLog` を 1 コミュニティごとに記録
- `TokenUsageLog` を 1 コミュニティごとに記録
- ADR-0033（新） を追加し、ADR-0030 のステータスを "Superseded by ADR-0033" に更新

### やらないこと
- `selectTargetCommunity.ts` ファイルの削除（#672/#673 で vote 重みを comment 生成に流用する可能性があるため保持）
- Cloud Tasks 方式（案 B）の実装（追加インフラ不要な案 A を採用）
- vote 重みによる生成頻度の動的調整（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `communityRepo.list()` が返す全コミュニティ数分の `generate` が呼ばれる
2. あるコミュニティの生成失敗（JSON パース失敗・API エラー等）が他のコミュニティに伝播しない
3. `BatchRunLog` が 1 コミュニティごとに 1 件記録される
4. 同一 `slotKey` で 2 回実行しても 2 回目は永続化されない（Cron 二重発火ガード）
5. `voteRepo` が `RunCommunityBatchDeps` に含まれない
6. `pnpm turbo run build test lint` が server ワークスペースで緑になる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 採用方式: 案 A（`Promise.allSettled`）

Cloud Run Job 内で全コミュニティを `Promise.allSettled` で並列処理する。
Cloud Tasks 追加不要で最小変更。失敗は `allSettled` が吸収し、他コミュニティに影響しない。

### `runCommunityBatch` の変更点

```
Before:
1. コミュニティ一覧取得
2. selectOneCommunity() で vote 重み付き 1 件選定
3. 選定した 1 コミュニティのみ処理
4. BatchRunLog/TokenUsageLog を 1 回記録

After:
1. コミュニティ一覧取得（0件→空返し）
2. Promise.allSettled(communities.map(async (community) => { ... }))
   - 各コミュニティを独立して処理
   - 失敗コミュニティは BatchRunLog(failure) を記録して空配列を返す
   - 成功コミュニティは BatchRunLog(success)/TokenUsageLog を記録
3. 全結果を集約して返す
4. worldState を一度だけ更新
```

### `worldStateRepository` の扱い

- `worldState` は全コミュニティ処理の前に 1 回 `get`
- 各コミュニティ処理内では `currentWorkerStates` を読み取り専用で使用（競合なし）
- 全コミュニティ処理完了後に 1 回 `upsert`（全コミュニティで登場した worker を集約）

### `slotKey` の扱い

- 全コミュニティ間で同一 `slotKey` を共有
- `(community_id, slot_key, seq)` の複合ユニーク制約により、各コミュニティで独立して Cron 二重発火ガードが機能

## 5. 影響範囲 / 既存への変更

- **server/src/batch/runCommunityBatch.ts**: 主要変更（`voteRepo` 削除、全コミュニティ並列処理）
- **server/src/batch/runCommunityBatch.test.ts**: ADR-0030 動作テスト削除、新動作テスト追加
- **server/src/batch/communityBatchIndex.ts**: `voteRepo` 削除
- **server/src/batch/communityBatchIndex.test.ts**: `voteRepo` 削除、ADR-0030 テスト更新
- **docs/adr/0033-all-communities-parallel-batch.md**: 新規追加
- **docs/adr/0030-weighted-single-community-batch.md**: ステータスを Superseded に更新
- **docs/adr/README.md**: ADR-0033 行追加

## 6. テスト計画（TDD で書くテスト一覧）

追加テスト:
- `"全コミュニティに対して generate が呼ばれる（#671）"` - 2 コミュニティ → 2 回呼ばれる
- `"あるコミュニティの生成失敗が他のコミュニティに伝播しない（#671）"` - community1 失敗 → community2 は成功
- `"BatchRunLog が 1 コミュニティごとに記録される（#671）"` - 2 コミュニティ → create 2 回

削除テスト（ADR-0030 動作の記述 → superseded）:
- `"複数コミュニティがあっても generate は最大 1 回だけ呼ばれる（1 コミュニティのみ選定）"`
- `"rng を固定すると決定的に選ばれたコミュニティのみ生成・永続化される"`
- `"vote の純スコアが高いコミュニティほど選ばれやすい（重み付き）"`
- `"vote 0 の新規コミュニティも床 +1 により選定対象になる"`

`communityBatchIndex.test.ts`:
- `"複数 community があっても 1 定時 = 1 コミュニティのみ生成される（#486）"` → 削除
- 新規: `"全コミュニティに対して generate が呼ばれる（#671）"` を追加

## 7. リスク・未決事項

- コミュニティ数が増えた場合の並列 API コール数増大（スコープ外・別 Issue で対応）
- `selectTargetCommunity.ts` が `runCommunityBatch.ts` 以外から利用されるかは現時点で不明（後続 Issue で利用可能性あり）
