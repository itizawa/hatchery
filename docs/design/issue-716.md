# 設計書: server/src/batch/runCommunityBatch.ts を責務ごとのモジュールに分割する (#716)

## 1. 目的 / 背景

`server/src/batch/runCommunityBatch.ts` は 553 行に肥大化しており、コミュニティ選択・直近コンテキスト取得・永続化といった複数の責務が 1 ファイルに混在している。受け入れ条件に従い、独立してテスト可能な小モジュールに分割する。

## 2. スコープ（やること / やらないこと）

やること:
- `selectOneCommunity` 関数を `selectTargetCommunity.ts` へ移設（`VOTE_WEIGHT_WINDOW_DAYS` 定数も一緒に移動）
- 直近 post/comment 取得・`RecentEntry` 変換・人気トピック取得を `fetchRecentContext.ts` へ移設
- post/comment/reply の永続化ロジックを `persistBatchOutput.ts` へ移設（400 行以下を達成するため）
- 各モジュールに独立したユニットテストを追加
- `runCommunityBatch.ts` の既存エクスポート（`runCommunityBatch`・`VOTE_WEIGHT_WINDOW_DAYS` の re-export 等）は外部インターフェースを維持

やらないこと:
- バッチの実行方式変更（#671）
- `runCommunityBatch` の引数型変更
- `VOTE_WEIGHT_WINDOW_DAYS` など定数の廃止

## 3. 受け入れ条件（テストに落とせる粒度）

1. `selectOneCommunity` が `selectTargetCommunity.ts` に移設され、独立したユニットテスト（`selectTargetCommunity.test.ts`）が存在する
2. `fetchRecentContext` が `fetchRecentContext.ts` に移設され、独立したユニットテスト（`fetchRecentContext.test.ts`）が存在する
3. `persistBatchOutput` が `persistBatchOutput.ts` に移設され、独立したユニットテスト（`persistBatchOutput.test.ts`）が存在する
4. 抽出後の `runCommunityBatch.ts` が 400 行以下
5. `runCommunityBatch.test.ts` が引き続き全 pass
6. `pnpm --filter @hatchery/server test` 全件グリーン
7. `pnpm turbo run build lint` グリーン

## 4. 設計方針

### 移設モジュール

**`selectTargetCommunity.ts`**
- `selectOneCommunity({ communities, voteRepo, rng, now })` を export
- `VOTE_WEIGHT_WINDOW_DAYS` 定数も export（`runCommunityBatch.ts` は re-export で維持）

**`fetchRecentContext.ts`**
- `fetchRecentContext({ postRepo, commentRepo, community, recentLimit, maxPostsForReply, now, popularPostsWindowDays, popularPostsMinScore, popularPostsLimit })` を export
- 戻り値: `{ recentLog, recentPostsForReply, popularPosts }`
- 定数（`MAX_RECENT_POSTS_FOR_REPLY`・`POPULAR_POSTS_*`）も同ファイルへ移動

**`persistBatchOutput.ts`**
- `persistBatchOutput({ postRepo, commentRepo, communityId, output, postRefMap, slotKey, commentSeqStart, now, dripWindowMs, rng })` を export
- 戻り値: `{ savedPosts, savedComments }`
- post の stagger・drip タイムスタンプ割当・2 パスコメント作成・reply 永続化を内包

### 行数見積もり

| 移設 | 削除行 | 呼出追加行 | 差分 |
|------|--------|-----------|------|
| selectOneCommunity | 29 | 1 (import) | -28 |
| fetchRecentContext | 45 | 8 | -37 |
| persistBatchOutput | 115 | 6 | -109 |
| 合計 | — | — | **-174** |

553 - 174 = 379 行（< 400 ✓）

## 5. 影響範囲 / 既存への変更

- `server/src/batch/runCommunityBatch.ts`（変更）: 3 つの関数を移設・call site を追加
- `server/src/batch/selectTargetCommunity.ts`（新規）
- `server/src/batch/selectTargetCommunity.test.ts`（新規）
- `server/src/batch/fetchRecentContext.ts`（新規）
- `server/src/batch/fetchRecentContext.test.ts`（新規）
- `server/src/batch/persistBatchOutput.ts`（新規）
- `server/src/batch/persistBatchOutput.test.ts`（新規）
- client・common・openapi.json: 変更なし

## 6. テスト計画

**selectTargetCommunity.test.ts**
- community が 0 件のとき null を返す
- vote がゼロでも全コミュニティが選ばれうる（rng=0 で最初のコミュニティが選ばれる）
- vote が高いコミュニティが rng に応じて選ばれる

**fetchRecentContext.test.ts**
- post も comment も 0 件のとき空の recentLog を返す
- recentPosts がある場合に recentPostsForReply が maxPostsForReply 件以内で返る
- popularPosts が minScore 以上のものだけ返る

**persistBatchOutput.test.ts**
- post が 1 件・comment が 0 件のとき post のみ永続化される
- comment の reply_to が有効なとき parentCommentId が設定される
- reply（既存 post 宛）が正しく永続化される
- 返された savedPosts / savedComments が正しい件数

## 7. リスク・未決事項

- `VOTE_WEIGHT_WINDOW_DAYS` は `runCommunityBatch.ts` からも現在 export されており、移設後も re-export が必要。
- `persistBatchOutput` の `commentSeqStart` は caller（runCommunityBatch の for loop）が管理するため、呼出側でインクリメントする必要がある（for loop ごとにリセットしてよい）。
