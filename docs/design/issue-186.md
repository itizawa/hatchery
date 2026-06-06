# 設計書: セッションを永続ストアに保存しサーバ再起動・リロードでログアウトしないようにする (#186)

## 1. 目的 / 背景

`express-session` のデフォルト `MemoryStore` はプロセス再起動でセッションが消失する。
`tsx watch` による dev サーバ再起動のたびにブラウザリロードでログアウトされる問題（#186）を解消する。
既存の PostgreSQL（Prisma 接続済み）を利用した `connect-pg-simple` ストアへ置き換える。

## 2. スコープ（やること / やらないこと）

**やること:**
- `AppDeps` に `sessionStore?: Store` を追加し DI 化（テスト・本番ともに注入可能）
- `connect-pg-simple` + `pg` を依存に追加
- `pgSessionStore.ts` ファクトリー（`DATABASE_URL` → `Store`）を新設
- `server.ts` で本番起動時に `pgSessionStore` を生成して注入
- 本番時（`NODE_ENV=production`）に `sessionStore` 未注入なら起動時例外（MemoryStore 使用防止）
- `session` テーブルの Prisma マイグレーション SQL を追加
- セッション永続テスト: 同一ストアを共有する別インスタンスでセッション復元を確認

**やらないこと:**
- sliding session / 複数デバイス管理 / Redis 化（別 Issue）
- クライアント側の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] `createApp({ ..., sessionStore: sharedStore })` でログイン後、同じ `sharedStore` を持つ別アプリインスタンスに cookie を送ると `GET /auth/me` が 200 を返す（サーバ再起動模擬）
- [ ] `NODE_ENV=production` かつ `sessionStore` 未注入の場合、`createApp()` が起動時例外を投げる
- [ ] ログアウト後 / 未ログイン時は `GET /auth/me` が引き続き 401 を返す（回帰なし）
- [ ] `pnpm --filter @hatchery/server test` が全緑
- [ ] `pnpm --filter @hatchery/server lint` が通過

## 4. 設計方針

### アーキテクチャ

```
server.ts (compose root)
  └─ createPgSessionStore(databaseUrl) → Store
       └─ connect-pg-simple + pg.Pool
  └─ createApp({ ..., sessionStore }) → Express app
       └─ session({ store: deps.sessionStore, ... })
```

### DI 設計

- `AppDeps.sessionStore?: import("express-session").Store`
- テスト: `new session.MemoryStore()` を注入（DB 不要）
- 本番: `createPgSessionStore(DATABASE_URL)` を注入
- 本番ガード: `NODE_ENV=production` + `!sessionStore` → 起動時 Error

### セッションテーブル

`connect-pg-simple` デフォルトスキーマで `session` テーブルを作成するマイグレーション SQL を追加。

## 5. 影響範囲 / 既存への変更

- **server**: `app.ts`（AppDeps 追加・ガード）、`server.ts`（store 注入）、`persistence/pgSessionStore.ts`（新規）
- **server/prisma**: `migrations/20260606000000_add_session_table/migration.sql`（新規）
- **server/src/routes/auth.test.ts**: テスト追加
- **client / common**: 変更なし

## 6. テスト計画

| テスト | 場所 |
|--------|------|
| 同一ストア共有・別インスタンスでセッション復元（AC-#3） | auth.test.ts |
| 本番環境で sessionStore 未注入 → 起動時例外（AC-#4） | app.security.test.ts |
| ログアウト後 401 維持（回帰確認）（AC-#5） | auth.test.ts（既存） |

## 7. リスク・未決事項

- `pg` パッケージは Prisma が間接依存するが、`server/package.json` には明示されていないため追加が必要
- テスト環境では実 DB 不要（`MemoryStore` を注入）なので CI への影響なし
- `connect-pg-simple` の `createTableIfMissing: true` はオプションだが、マイグレーションで明示管理する
