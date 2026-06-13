# Issue #486 設計書: 定時バッチを vote 重み付きランダムで 1 コミュニティだけ選んで会話生成する

## 目的 / 背景

現状の定時バッチ `runCommunityBatch` は `communityRepo.list()` で全コミュニティを取得し、コミュニティごとに 1 API コールで会話生成する。このため Claude API コストが **コミュニティ数 × 定時回数/日** で線形に増える。

本 Issue では、毎定時に **vote 重み付きランダムで 1 コミュニティだけを選び、そのコミュニティのみ生成・永続化** する方式へ変更する。これにより API コール/定時が **常に最大 1 回** に固定され、コストがコミュニティ数から切り離される。

設計判断（合意済み・確定事項）: 純スコア（up − down）/ 直近 7 日 / 床 +1 / 重み付きランダム。

## 全体方針

1. **選定ロジック（common・純粋関数）**: `common/src/logic/selectWeightedCommunity.ts` を新規追加。各コミュニティの `{ communityId, weight }` と注入可能な乱数源 `() => number` を受け取り、重み付きランダムで 1 件の id を返す（0 件なら null）。`selectAppearingMembers.ts` を雛形とし、乱数注入で決定的にテストする。
2. **重み算出（server）**: vote の純スコア集計は server 永続化層に追加する。`VoteRepository` に「直近 N 日の community 別純スコア（up − down）合計」を返すメソッド `netScoresByCommunitySince(since: Date)` を追加し、Prisma 実装・インメモリ実装の両方をそろえる。
3. **重みへの変換（server・バッチ内）**: バッチ本体で `weight = max(0, netScore) + 1` を適用する。集計期間は名前付き定数 `VOTE_WEIGHT_WINDOW_DAYS = 7` として `runCommunityBatch.ts` に定義する。床 +1 により vote 0・新規コミュニティも必ず正の重みを持つ。
4. **バッチ本体（server）**: 全コミュニティループをやめ、選定した 1 コミュニティのみ生成・永続化する。既存の slotKey 二重発火ガード・`(community_id, slot_key, seq)` 複合ユニーク制約はそのまま機能させる。

## なぜ純スコア集計を server に置くか

`Vote.targetId` は Post / Comment の id を多態参照しており（DB FK なし）、「community 別の純スコア」を出すには Post / Comment を介して community に紐づける結合集計が必要。これは DB クエリ（Prisma）の責務であり、common（実行環境非依存）には置けない。よって **集計は server、重み付きランダム選定の純粋ロジックは common** と責務分割する（import 境界: server → common の一方向を維持）。

純スコアは「直近 7 日の Vote レコード」を `targetType` / `targetId` で Post / Comment に解決し、community 単位で `up を +1 / down を -1` として合計する。`Post.score` / `Comment.score` は累積値で時系列の窓を切れないため、本集計では `Vote.createdAt` 基準の生 Vote から計算する。

## 受け入れ条件への対応

### AC1 / AC2: 選定ロジック（common 純粋関数）と重み算出ルール

`common/src/logic/selectWeightedCommunity.ts`:

```
export interface CommunityWeight {
  communityId: string;
  weight: number; // 正の重み（呼び出し側で床 +1 済みを想定するが、関数自体は weight>=0 を許容）
}

export const selectWeightedCommunity = (
  communities: readonly CommunityWeight[],
  rng: () => number = Math.random,
): string | null
```

- 累積重み法: `total = Σ weight`。`r = rng() * total` とし、累積和が初めて `r` を超えるコミュニティを選ぶ。
- 0 件 → null。1 件のみ → そのコミュニティ。weight 0 のコミュニティは「他に正の重みがある限り」選ばれない（床 +1 は呼び出し側の責務だが、関数の決定性は weight=0 を含めても保証する）。
- `total <= 0`（全 weight 0）の場合は先頭コミュニティを返す（フォールバック・決定的）。
- 境界テスト（rng 固定で決定的）:
  - 累積重みのちょうど境界値（`r` が累積和に一致するケース）。
  - weight 0 のコミュニティが選ばれない。
  - 床（+1）の振る舞いは `runCommunityBatch` 側のテスト（後述）で「vote 0 でも稀に選ばれる」を担保。
  - コミュニティ 1 件のみ → 常にそれを返す。
  - コミュニティ 0 件 → null。

重み算出ルール（AC2）は **バッチ側** で `weight = max(0, netScore) + 1` を適用し、集計期間は `VOTE_WEIGHT_WINDOW_DAYS = 7`（名前付き定数）で切り出す。「vote 0 の新規コミュニティが稀に選ばれる」ことは、純粋関数 `selectWeightedCommunity` に床込みの重みを渡し、rng を境界付近に固定したテストで担保する。

### AC3: `runCommunityBatch` を 1 コミュニティ選定方式に変更

- `communityRepo.list()` で全件取得 → `voteRepo.netScoresByCommunitySince(since)` で純スコアを取得 → 各コミュニティに床 +1 を適用して `CommunityWeight[]` を作る → `selectWeightedCommunity` で 1 件選定。
- 選ばれた 1 コミュニティのみ、従来の生成・検証・永続化フローを実行する。
- コミュニティ 0 件 → 何も生成せず正常終了（既存挙動と整合）。
- `generate`（AI 生成関数）の呼び出し回数が **最大 1 回** であることをテストで検証する。
- 二重発火ガード（slotKey）・複合ユニーク制約は従来どおり。
- `RunCommunityBatchDeps` に `voteRepo: VoteRepository` と、テスト用に注入可能な `rng?: () => number`、集計の基準時刻を固定するための `now?: Date`(任意) を追加する。

### AC4: vote 集計の取得手段を server 永続化層に追加

`VoteRepository.netScoresByCommunitySince(since: Date): Promise<Map<string, number>>`（communityId → 純スコア）を Prisma / インメモリ両方に実装する。

- Prisma 実装: Vote を `createdAt >= since` で取得し、`targetType`/`targetId` で Post / Comment の communityId に解決して community 別に集計する（`up: +1, down: -1`）。MVP 規模では取得→アプリ集計で十分。
- インメモリ実装: テスト注入のため、Vote レコードと「targetId → communityId 解決関数」を持たせる必要がある。既存インメモリ Vote リポジトリは Post/Comment を知らないため、`createInMemoryVoteRepository` に「targetId → communityId」解決を担う任意の `resolveCommunityId` を受け取れるよう拡張するか、テスト専用に純スコアを直接 seed できる形にする。→ 後方互換のため `createInMemoryVoteRepository(resolveCommunityId?)` のオプション引数として追加する。

### AC5: ドキュメント更新

- `CLAUDE.md`: 「community ごと 1 API コール（毎定時に全コミュニティ処理）」を「1 定時 = vote 重み付きランダムで 1 コミュニティ・1 API コール」に更新。
- `runCommunityBatch.ts` の docstring を新方式に更新。
- ADR-0030 を新規追加（生成方式を 1 定時 = 1 コミュニティへ変更。ADR-0009 / ADR-0019 の生成方式を一部 supersede）し、`docs/adr/README.md` 一覧に追記。

### AC6: e2e ユースケース更新

毎定時に全コミュニティではなく 1 コミュニティだけ新着が出るようになる。バッチはサーバ側 cron でユーザー操作起点ではないため e2e 自動テストの直接対象ではないが、`e2e/home-feed/usecases.md` に「定時ごとに更新されるのは選ばれた 1 コミュニティのみ」という観察可能な前提を補記し、`e2e/usecases.md` の該当行に反映する。

### AC7: build / test / lint 緑、import 境界遵守

選定ロジックは common、vote 集計は server に置く。client → common / server → common の一方向のみ。

## TDD 計画

1. `common/src/logic/selectWeightedCommunity.test.ts` — 境界（累積境界値・weight 0・1件・0件・rng 固定で決定的）。
2. `server/src/persistence/voteRepository.test.ts` — インメモリ `netScoresByCommunitySince`（直近 N 日・up/down 純スコア・community 別集計・期間外除外）。
3. `server/src/batch/runCommunityBatch.test.ts` — 既存テストを 1 コミュニティ方式へ修正（generate 呼び出し最大 1 回・選定が rng で決定的・vote 0 でも床で選定対象・0 件で空）。

各ステップで先にテストを書き失敗を確認 → 最小実装で緑にする。

## スコープ外

重みの式の動的チューニング、減衰関数、複数コミュニティ同時選定は別 Issue。
