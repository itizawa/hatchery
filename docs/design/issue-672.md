# 設計書: post 生成バッチを comment 生成から分離し1日1回・全コミュニティ各1〜3件で生成する (#672)

## 1. 目的 / 背景

#671 で定時バッチが「全コミュニティ並列処理（Promise.allSettled）」に変わった。
現状の `runCommunityBatch.ts` は 1 API コールで post と comment をまとめて生成し、1 日 4 回（JST 9/12/15/18）に実行されている。

本 Issue では **post 生成を comment 生成から独立したバッチに分離**する。

- Post バッチ: 1 日 1 回、コミュニティごとに 1〜3 件の独立 post を生成
- Comment バッチ（#673）: 従来頻度（1 日 4 回）で直近の post に対してコメントを付ける（後続 Issue）

## 2. スコープ（やること / やらないこと）

**やること:**
- `runPostBatch.ts` / `postBatchIndex.ts` 作成（post 専用バッチ本体 + エントリ）
- `buildPostPrompt.ts` 作成（post のみを生成するプロンプト）
- post に `assignDripTimestamps` で 24h 窓内のドリップタイムスタンプを付与
- 全コミュニティ並列処理（Promise.allSettled、#671 / ADR-0033 踏襲）
- `BatchRunLog` + `TokenUsageLog` コミュニティごとに記録
- WorldState の `lastAppearedSlotKey` を更新（登場ローテーション #464）
- ADR-0034 に設計判断を記録
- `package.json` に `batch:post` スクリプト追加

**やらないこと:**
- comment 生成（#673 で実施）
- 既存 `communityBatchIndex.ts` / `runCommunityBatch.ts` の変更（#673 で扱う）
- Cloud Scheduler の実際の設定変更（ADR-0034 にドキュメント化のみ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. **post 専用エントリ**: `postBatchIndex.ts` が存在し、`runPostBatchCli` でラップされた `runPostBatch` を呼び出す。comment 生成は行わない。
2. **全コミュニティ並列**: 全コミュニティが `Promise.allSettled` で並列処理され、1 コミュニティ失敗が他に影響しない。`generate` は community 数分呼ばれる。
3. **post 件数 = rng ベース**: `pickInRange(POST_COUNT_MIN=1, POST_COUNT_MAX=3, rng)` で決定。rng=0 → min、rng→1 → max を単体テストで確認。
4. **drip タイムスタンプ**: `assignDripTimestamps` で post の `createdAt` を 24h 窓内に散らす。生成された post の `createdAt` が `now` 以降 `now + dripWindowMs` 未満の範囲に収まる。
5. **コメントは保存しない**: `commentRepo.createMany` は呼ばれない（post-only バッチ）。
6. **BatchRunLog 記録**: 成功 community → `status: "success"`、失敗 → `status: "failure"`、コミュニティごとに 1 件記録。
7. **API key 未設定時スキップ**: `anthropicApiKey` が undefined のとき、generate を呼ばずに `{ posts: [] }` を返す。

## 4. 設計方針

### 新規ファイル構成

```
server/src/batch/
  buildPostPrompt.ts        # post 専用プロンプト（コメント指示なし）
  buildPostPrompt.test.ts
  runPostBatch.ts           # post 専用バッチ本体
  runPostBatch.test.ts
  postBatchIndex.ts         # エントリポイント（1日1回）
  postBatchIndex.test.ts
```

### buildPostPrompt

`buildCommunityPrompt` を参考に、コメント指示を除いたプロンプトを構築する純粋関数。

- パラメータ: `{ community, workers, recentLog, countHints?: { postCount } }`
- 出力 JSON 例に `comments: []` を明示し、コメント生成しないよう指示する
- `replies` も空にするよう指示（post バッチは新規 post のみ）

### runPostBatch のコア処理（per community）

```
1. workerCommunityRepo.listWorkersByCommunity → resolvedWorkers
2. selectRotatedWorkers でローテーション順序を決定
3. pickInRange(POST_COUNT_MIN, POST_COUNT_MAX, rng) → postCount
4. buildPostPrompt で post 専用プロンプト構築
5. generate(prompt, apiKey) → raw
6. JSON.parse → GenerationOutputSchema.safeParse → validateGenerationOutput
7. assignDripTimestamps(slotAt=now, windowMs=dripWindowMs, count=postCount, rng)
   → post の createdAt を dripWindowMs 内に散らす
8. postRepo.createMany with drip createdAt
9. BatchRunLog(success) + TokenUsageLog
```

### drip 窓

Post バッチのデフォルト drip 窓は `DEFAULT_POST_DRIP_WINDOW_MS = 24 * 60 * 60 * 1000`（24h）。
env.postBatchDripWindowMs から上書き可能（postBatchIndex.ts で注入）。

### WorldState 更新

全コミュニティ処理後、登場したワーカーの `lastAppearedSlotKey` を一括 upsert。

## 5. 影響範囲

- **追加**: `server/src/batch/buildPostPrompt.ts`, `runPostBatch.ts`, `postBatchIndex.ts` と各テスト
- **追加**: `docs/adr/0034-post-comment-batch-split.md`
- **変更**: `server/package.json` に `"batch:post"` スクリプト追加
- **変更なし**: 既存 `runCommunityBatch.ts` / `communityBatchIndex.ts`（#673 で対処）

## 6. テスト計画

### buildPostPrompt.test.ts
- プロンプトに `posts` 指示が含まれる
- プロンプトにコメント件数指示が含まれない
- `postCount` ヒントが含まれる

### runPostBatch.test.ts
- 全コミュニティに generate が呼ばれる
- post の createdAt が drip 窓内に収まる
- comment は保存されない
- 1 コミュニティ失敗が他に波及しない
- BatchRunLog が success/failure でコミュニティごとに記録
- API key 未設定時スキップ
- WorldState が更新される

### postBatchIndex.test.ts
- runCommunityBatchCli 相当のラッパーテスト

## 7. リスク・未決事項

- 既存の `communityBatchIndex.ts`（post+comment 両方生成）と post バッチを両方起動すると post が二重生成される。#673 完了まで Cloud Scheduler には post バッチジョブを**追加しない**（コードのみ実装、スケジューリングは#673完了後に切り替え）。
- drip 窓が 24h のため、`now` で reveal フィルタをかけると batch 直後に post が全件見えず徐々に解禁される。これはデザイン通りの挙動。
