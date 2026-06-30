# 設計書: client/src/api/subscriptions.ts の fetchSubscriptionStatus のテストを追加する (#938)

## 1. 目的 / 背景

`client/src/api/subscriptions.ts` の `fetchSubscriptionStatus` 関数は、コミュニティの購読状態を取得する関数だが、既存の `subscriptions.test.ts` にテストが存在しない。`fetchSubscriptionStatus` は `openApiClient` を経由せず `fetch` を直接呼び、エラー処理分岐を持つため、テスト不足が回帰リスクになる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `subscriptions.test.ts` に `fetchSubscriptionStatus` のテストを追加する

**やらないこと:**
- `useSubscribe` / `useUnsubscribe` フックのテスト
- 実装コードの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `200 + { subscribed: true }` のとき `{ subscribed: true }` を返す
2. `200 + { subscribed: false }` のとき `{ subscribed: false }` を返す
3. `4xx` のとき例外を throw する
4. `5xx` のとき例外を throw する
5. URL に `encodeURIComponent(slug)` が含まれる（特殊文字を含むスラッグのエンコード確認）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `vi.stubGlobal("fetch", ...)` で `fetch` をモックする（既存テストのパターンと統一）
- `afterEach` で `vi.unstubAllGlobals()` を呼ぶ（既存テストと統一）
- `describe("fetchSubscriptionStatus (GET /api/communities/{slug}/subscription)", ...)` ブロックを追加

## 5. 影響範囲 / 既存への変更

- 変更対象ワークスペース: `client/`
- 変更ファイル: `client/src/api/subscriptions.test.ts`（追記のみ）

## 6. テスト計画（TDDで書くテスト一覧）

| ケース | 入力 | 期待 |
|--------|------|------|
| 購読済み true | slug="ai-dev", res=200+{subscribed:true} | `{subscribed:true}` を返す |
| 購読済み false | slug="ai-dev", res=200+{subscribed:false} | `{subscribed:false}` を返す |
| 4xx エラー | res=401 | throw Error |
| 5xx エラー | res=500 | throw Error |
| スラッグのエンコード | slug="スラッグ/test" | URLに encodeURIComponent が適用される |

## 7. リスク・未決事項

なし。既存の `fetch` モックパターンをそのまま流用できる。
