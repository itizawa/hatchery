# 設計書: pgSessionStore の get / set / destroy セッション操作の単体テストを追加する (#943)

## 1. 目的 / 背景

`server/src/persistence/pgSessionStore.ts` は PostgreSQL を使った Express セッションストアだが、既存テストはコンストラクタの設定のみを検証し、`get`・`set`・`destroy` といったセッション操作は未テスト。セッションの正常動作は認証全体の基盤であり、thin coverage は高リスク。

## 2. スコープ（やること / やらないこと）

- **やること**: `pgSessionStore.test.ts` に `set` / `get` / `destroy` の単体テストを追加する
- **やらないこと**: 実 PostgreSQL を使った統合テスト（別 Issue 相当）、`touch` の追加テスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `set(sid, session, callback)` → callback が呼ばれる（エラーなし）
2. `get(sid, callback)` で存在するセッション → callback が `(null, session)` で呼ばれる
3. `get(sid, callback)` で存在しないセッション → callback が `(null, null)` で呼ばれる
4. `destroy(sid, callback)` → callback が呼ばれ、そのセッションが削除される
5. `pnpm turbo run test --filter=@hatchery/server` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

既存テストは `connect-pg-simple` をファクトリごと vi.mock で差し替え、DummyPgStore（session.Store を継承）を返す。このパターンを踏襲し、DummyPgStore に `get` / `set` / `destroy` を追加する。

- ストレージ: in-memory `Map<string, session.SessionData>`（ファイルスコープで宣言、各テスト前に clear）
- DB 接続: 不要（connect-pg-simple モック内で Map を操作）
- ESLint max-params: 外部 I/F 都合（express-session Store のメソッドシグネチャ）なので `eslint-disable-next-line max-params` で許容

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **server**
- 変更ファイル: `server/src/persistence/pgSessionStore.test.ts` のみ
- `pgSessionStore.ts` 本体は変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| # | テストケース | 期待する動作 |
|---|--------------|------------|
| 1 | set でコールバックが呼ばれる | callback() が 1 回呼ばれる |
| 2 | get で存在するセッションを取得できる | callback(null, sessionData) |
| 3 | get で存在しないセッションは null | callback(null, null) |
| 4 | destroy でセッションが削除される | callback() 呼ばれ Map から消える |

## 7. リスク・未決事項

- vi.mock ファクトリ内で Map を参照するため、Vitest のホイスティング挙動に依存する。既存テストが同パターン（pgSessionOptions）で動作しているため問題ない想定。
