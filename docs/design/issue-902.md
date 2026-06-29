# 設計書: client/src/api/workers.ts の useWorkerRanking フックのテストを追加する (#902)

## 1. 目的 / 背景

`client/src/api/workers.test.tsx` には `useBotWorkers`・`useUpdateWorker`・`useUploadWorkerImage` のテストが存在するが、`useWorkerRanking`（GET /api/workers/ranking）のテストが欠落している。`useWorkerRanking` は #665 で追加されたが #709 のテスト追加対象に含まれなかった。ランキング取得のリグレッションを検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/api/workers.test.tsx` に `useWorkerRanking` のテスト describe ブロックを追加する
- 正常系（200 OK）と異常系（500 エラー）の 2 ケースを実装する
- 正しいエンドポイント（GET /api/workers/ranking）が呼ばれることを検証する

**やらないこと**
- WorkerRankingScene のコンポーネントテスト（#784 CLOSED 済み）
- 他フックのテスト追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/api/workers.test.tsx` に `useWorkerRanking` の describe ブロックが存在する
2. 200 OK のとき `WorkerRankingItem[]` が `data` として解決される（`data` は `undefined` を取らない）
3. エラー応答のとき `throw` されて ErrorBoundary に捕捉される
4. 正しいエンドポイント（`GET /api/workers/ranking`）が呼ばれる
5. `pnpm turbo run test lint --filter @hatchery/client` が緑

## 4. 設計方針

`useWorkerRanking` は `useSuspenseQuery` を使用しているため、`useBotWorkers` と同じ `createSuspenseWrapper()` パターンでテストする。

差異点：
- `useWorkerRanking` は `unwrap()` を使うため、エラー時は response.ok が false または error があれば throw する
- レスポンス形式は `{ workers: WorkerRankingItem[] }` を含むオブジェクト
- `WORKER_RANKING_QUERY_KEY` を import して query key をテストで利用可能にする

モックレスポンス:
- 成功: `{ status: 200, body: { workers: [mockWorkerRankingItem] } }`
- エラー: `{ status: 500, body: { error: "Server Error" } }`

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client**
変更ファイル: `client/src/api/workers.test.tsx`（テスト追加のみ）

## 6. テスト計画（TDDで書くテスト一覧）

```
describe("useWorkerRanking (GET /api/workers/ranking, useSuspenseQuery)")
  it("200 のとき WorkerRankingItem[] が data として解決される（data は undefined を取らない）")
  it("エラー応答のとき throw されて ErrorBoundary に捕捉される")
  it("正しいエンドポイント GET /api/workers/ranking が呼ばれる")
```

## 7. リスク・未決事項

- なし。既存テストのパターンに完全に準拠しており、リスクは低い。
