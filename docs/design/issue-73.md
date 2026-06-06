# 設計書: DATABASE_URL に接続タイムアウトパラメータを明示設定・ドキュメント化する (#73)

## 1. 目的 / 背景

現在 `DATABASE_URL` は Prisma/PostgreSQL への接続 URL として機能するが、接続タイムアウト・プール待機タイムアウトのパラメータが未設定。接続プール枯渇や DB 無応答時にリクエストが indefinitely ブロックされるリスクがある。PostgreSQL 接続 URL のクエリパラメータとしてタイムアウト値を明示し、開発者が適切な値を設定できるようにする。

## 2. スコープ（やること / やらないこと）

### やること

- `.env.example` の `DATABASE_URL` に `connect_timeout=10&pool_timeout=10` を追加する
- `server/src/config/env.ts` の `DATABASE_URL` 検証がタイムアウトパラメータ付き URL を通過させることをテストで確認する
- `docs/design/issue-73.md`（本ドキュメント）に設定方法・推奨値を記載する

### やらないこと

- `statement_timeout`（PostgreSQL 側のクエリ実行タイムアウト）の設定（管理コスト高・本 Issue スコープ外）
- Prisma のコネクションプール設定 (`connection_limit` 等) の変更
- 本番 DB（Supabase / Railway / Cloud SQL 等）のホスティング設定

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `loadEnv` に `connect_timeout=10&pool_timeout=10` を含む `DATABASE_URL` を渡すと、そのまま `databaseUrl` として返される
- `connect_timeout` 等のパラメータを含む URL が `z.string().min(1)` バリデーションを通過する（既存バリデーションで対応済みだが明示的に確認）
- `.env.example` の `DATABASE_URL` が `?schema=public&connect_timeout=10&pool_timeout=10` 形式になっている
- 既存の `env.test.ts` が全て通過する
- `turbo run lint test` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### DATABASE_URL のタイムアウトパラメータ

PostgreSQL 接続 URL のクエリパラメータとして設定する:

```
postgresql://user:pass@host:5432/db?schema=public&connect_timeout=10&pool_timeout=10
```

| パラメータ | 推奨値（本番） | 説明 |
|---|---|---|
| `connect_timeout` | 10 秒 | TCP 接続確立の上限 |
| `pool_timeout` | 10 秒 | プール待機の上限 |

- `connect_timeout`: Prisma が PostgreSQL への TCP 接続を確立するタイムアウト（秒単位）
- `pool_timeout`: Prisma の接続プールから接続を取得するまでのタイムアウト（秒単位）

### `env.ts` の検証方針

現在の `DATABASE_URL` スキーマは `z.string().min(1).optional()` で、URL フォーマットの詳細検証は行わない。タイムアウトパラメータを追加してもクエリパラメータとして URL の一部であるため、バリデーション変更不要。既存テストにタイムアウトパラメータ付き URL のケースを追加して確認する。

### ローカル開発での注意

開発環境（docker-compose）では `connect_timeout=10&pool_timeout=10` は問題なく機能する（ローカル DB なので接続は高速）。統合テスト（`.int.test.ts`）も `DATABASE_URL` が設定されている場合のみ実行されるため影響なし。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|---------|
| `server/.env.example` | `DATABASE_URL` に `connect_timeout=10&pool_timeout=10` を追加 |
| `server/src/config/env.test.ts` | タイムアウトパラメータ付き URL のテストケース追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### server/src/config/env.test.ts（追加）

- `DATABASE_URL` にタイムアウトパラメータ（`connect_timeout=10&pool_timeout=10`）を含む URL を渡すと `databaseUrl` にそのまま格納される
- URL フォーマットの違いによってバリデーションが壊れないことを確認

## 7. リスク・未決事項

- 既存の `.env` ファイル（個人の開発環境）は自動更新されないため、開発者が手動で追記する必要がある
- ローカル docker-compose 環境では `schema=public` のみで問題なく動作していたため、既存環境への影響は `.env.example` の変更のみ
