# 設計書: community レスポンス整形の直接テスト (#585)

## 1. 目的 / 背景

`server/src/routes/communityResponse.ts` の `toCommunityResponse` / `toAdminCommunityResponse`
は公開 API・admin API のレスポンス整形を担う重要な変換層だが、専用のユニットテストが存在しない。
`postResponse.test.ts` と同水準のテストを追加し、リグレッション防止と契約の明示を行う（#585）。

## 2. スコープ（やること / やらないこと）

- やること: `server/src/routes/communityResponse.test.ts` を新設してユニットテストを追加する
- やらないこと: `communityResponse.ts` 本体の実装変更、他ファイルへの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `toCommunityResponse` が CommunityRecord の camelCase フィールドを snake_case の公開 API 形式に変換する
- `synopsis` が null のとき undefined（optional フィールド）として出力される
- `lastSlotKey` が null のとき `last_slot_key` が undefined として出力される
- `iconUrl` / `coverUrl` の null は null のまま出力される（undefined にならない）
- `generationInstruction` はレスポンスに含まれない（公開 API への漏洩防止・#488）
- `stats` 省略時は `post_count=0`、`last_post_at=null` になる
- `stats` 指定時は `post_count` と `last_post_at`（ISO8601 文字列）が正しく出力される
- camelCase キー（`createdAt`・`lastSlotKey`・`iconUrl` 等）がレスポンスに含まれない
- `toAdminCommunityResponse` は公開フィールドに加えて `generationInstruction` を含む
- `generationInstruction` が null のとき null として出力される

## 4. 設計方針

`postResponse.test.ts` のパターンを踏襲する:
- `baseRecord` を一か所で定義し、各テストは spread で最小限の差分だけ上書きする
- `describe` / `it` の粒度は「1 条件 = 1 it」
- 型アサーションは `as Record<string, unknown>` で存在確認のみ行う

## 5. 影響範囲 / 既存への変更

- 追加: `server/src/routes/communityResponse.test.ts`（新規ファイルのみ）
- 変更なし: 本体実装・他ルート・共通層

## 6. テスト計画（TDDで書くテスト一覧）

### toCommunityResponse
1. 全フィールドの snake_case 変換（synopsis/lastSlotKey に値がある場合）
2. synopsis=null → undefined
3. lastSlotKey=null → last_slot_key=undefined
4. iconUrl=null → null（undefined でない）
5. coverUrl=null → null（undefined でない）
6. generationInstruction がキー自体として存在しない
7. stats 省略 → post_count=0, last_post_at=null
8. stats 指定 → post_count・last_post_at(ISO8601) が正しい
9. camelCase キー（createdAt / lastSlotKey / iconUrl / coverUrl）を含まない

### toAdminCommunityResponse
10. 公開フィールドすべてを含む
11. generationInstruction（文字列）が含まれる
12. generationInstruction=null → null として含まれる

## 7. リスク・未決事項

なし（純粋なテスト追加のため実装リスクなし）
