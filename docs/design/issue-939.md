# 設計書: GET /api/communities/:slug/feed の sessionId / my_vote 付与シナリオのサーバーテストを追加する (#939)

## 1. 目的 / 背景

`GET /api/communities/:slug/feed` は `sessionId` クエリパラメータを受け取ると各 post に `my_vote` フィールドを付与する（#831 対応）。  
ホームフィード側（`feed.test.ts`）では同ロジックがカバーされているが、コミュニティフィード側（`communities.test.ts`）では sessionId / my_vote テストがゼロで、リグレッション保護がない。

## 2. スコープ（やること / やらないこと）

**やること**
- `server/src/routes/communities.test.ts` の `GET /api/communities/:slug/feed` describe ブロックに my_vote シナリオ 4 ケースを追加する

**やらないこと**
- 実装コードの変更（ルートハンドラは #831 で実装済み）
- クライアント側テスト

## 3. 受け入れ条件（テストに落とせる粒度）

1. `sessionId` 付き・投票済み post → `my_vote: "up"` が付く
2. `sessionId` 付き・未投票 post → `my_vote` フィールドが存在しない
3. `sessionId` 未指定 → `my_vote` フィールドが存在しない（後方互換）
4. 不正 `sessionId`（UUID でない文字列）→ `my_vote` なし（`extractSessionId` が null を返す仕様）

## 4. 設計方針

- 参照実装: `server/src/routes/feed.test.ts:367-424`（同一パターン）
- `createInMemoryVoteRepository` を使い、`vote()` でテストデータを注入する
- `createTestDeps` に `voteRepository` を上書き渡しする

## 5. 影響範囲 / 既存への変更

- `server/src/routes/communities.test.ts`（テスト追加のみ）
- 実装コードへの変更なし

## 6. テスト計画

| ケース | sessionId | 投票状態 | 期待 |
|--------|-----------|----------|---------|
| 投票済み sessionId | UUID(valid) | up 投票あり | `my_vote: "up"` が付く |
| 未投票 sessionId | UUID(valid) | 投票なし | `my_vote` なし |
| sessionId 未指定 | なし | — | `my_vote` なし |
| 不正 sessionId | "not-a-uuid" | — | `my_vote` なし（extractSessionId が null 返却） |

## 7. リスク・未決事項

なし。実装済みロジックのテスト追加のみで、実装変更リスクはゼロ。
