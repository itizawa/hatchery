# 設計書: GET /api/workers/ranking のソート順テスト追加 (#942)

## 1. 目的 / 背景

`GET /api/workers/ranking` は `view_count` 降順 → 同数時は `vote_net_score` 降順でワーカーをソートして返す。
既存テスト（`workers.test.ts` L191-L250）はレスポンスフォーマットと空配列の確認のみで、
ソート順を検証するテストが一切ない。ソートロジックが壊れても既存テストは通ってしまう。

## 2. スコープ（やること / やらないこと）

やること:
- `workers.test.ts` の `GET /api/workers/ranking` describe ブロックにソート順テストを追加する

やらないこと:
- 実装ロジックの変更
- ページネーション上限（RANKING_LIMIT）の検証

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 複数ワーカーを登録し、view_count の多い順に並ぶことを検証する
   - 例: view_count 10 > 5 > 1 の場合、その順序で返る
2. view_count が同数の場合は vote_net_score 降順になることを検証する
3. view_count・vote_net_score ともに 0 の場合は全ワーカーが返る（順不問）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### view_count の注入方法

`createInMemoryViewRepository(resolveAuthor?)` の `resolveAuthor` 引数で
`(targetType, targetId) → workerId` を解決する関数を渡す。

テストでは post の targetId を workerId に直接マッピングする:
```ts
const resolveAuthor = (_type: string, targetId: string) => targetId;
```
こうすることで `recordPostView(workerId, sessionId)` で worker の view_count を増やせる。

### vote_net_score の注入方法

in-memory `netScoresByWorkerSince` は `r.targetId` を直接スコアのキーとして使う。
テストでは `voteRepo.vote({ ..., targetId: workerId, ... })` で worker のスコアを設定する。

### ソート確認方法

`res.body.workers.map(w => w.worker_id)` の配列順序が期待順であることを `toEqual` で検証する。

## 5. 影響範囲 / 既存への変更

- `server/src/routes/workers.test.ts` にテストを追加するのみ
- 実装コードは変更しない

## 6. テスト計画

1. view_count 多い順ソートを検証するテスト（ワーカー3件、異なる view_count）
2. view_count 同数時の vote_net_score 降順ソートを検証するテスト（ワーカー2件）
3. view_count・vote_net_score ともに 0 の場合の動作確認（件数のみ検証）

## 7. リスク・未決事項

- in-memory の `netScoresByWorkerSince` が `targetId` を workerId として扱う点は、実装コメントの「in-memory では createdAt フィルタを省略」から意図的なテスト用の簡略化と判断する。
