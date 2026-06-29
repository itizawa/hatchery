# 設計書: server/src/routes/extractSessionId.ts のユニットテストを追加する (#895)

## 1. 目的 / 背景

`server/src/routes/extractSessionId.ts` は `req.query.sessionId` を UUID バリデーション付きで取得する純粋ヘルパ関数（#831 で追加）。対応するテストファイルが存在せず、UUID フォーマット不正・未指定のフォールバック挙動が壊れると vote 機能全体に影響するリスクがある。TDD 方針にも未対応のため、テストを追加してリグレッション検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/routes/extractSessionId.test.ts` を新設し Vitest で 3 パターンを網羅

**やらないこと:**
- `extractSessionId` の Express 統合テスト（app.ts レベル）
- extractSessionId 本体の修正

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `extractSessionId.test.ts` を新設し Vitest で実装する
2. 有効な UUID v4 文字列を `sessionId` クエリパラメータとして渡した場合、その値を返す
3. UUID フォーマット不正（例: `"not-a-uuid"`）の場合、`null` を返す
4. `sessionId` クエリパラメータ未指定の場合、`null` を返す
5. `pnpm turbo run test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `extractSessionId` は純粋関数（副作用なし・DB 不要）なので、Express `Request` の最小モックオブジェクト（`{ query: { sessionId: ... } }` の型キャスト）で十分テストできる
- supertest や createApp 等の重いセットアップは不要
- テストパターン: 正常系（有効 UUID）/ 異常系（フォーマット不正）/ 未指定

## 5. 影響範囲 / 既存への変更

- **server**: `extractSessionId.test.ts` 追加のみ
- 既存コードの変更なし

## 6. テスト計画（TDDで書くテスト一覧）

- `extractSessionId` — 有効 UUID v4 文字列を返す
- `extractSessionId` — UUID 不正フォーマットで null を返す
- `extractSessionId` — sessionId 未指定で null を返す

## 7. リスク・未決事項

特になし。純粋ヘルパ関数のため実装が明確。
