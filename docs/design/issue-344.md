# 設計書: 本番リリース前セキュリティ点検（v1.2.0）(#344)

## 1. 目的 / 背景

v1.2.0 で初めて本番環境へデプロイするにあたり、セキュリティ施策が本番設定でも正しく機能することを確認・補強する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `Content-Security-Policy` ヘッダの追加（`secureHeaders` に未実装）
- `SESSION_SECRET` 環境変数を Zod スキーマへ追加し、起動時検証を統一
- 本番環境で CORS ワイルドカード `*` を拒否するバリデーション追加
- `server/.env.example` に `SESSION_SECRET` を REQUIRED として明記
- 既存の pnpm audit 戦略（`--prod` フラグ）の確認・文書化

**やらないこと:**
- ペネトレーションテスト・外部診断
- devDependency の脆弱性修正（CI は `--prod` で除外済み・既存テストで確認済み）
- Cloudflare Pages / Cloud Run のインフラ設定変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `pnpm audit --audit-level=high --prod` がゼロ件（CI は既に `--prod` 付き）
2. `Content-Security-Policy: default-src 'none'` が全レスポンスに付与される
3. `Strict-Transport-Security` が enableHsts=true で付与される（既存）
4. `X-Frame-Options: DENY` が付与される（既存）
5. `X-Content-Type-Options: nosniff` が付与される（既存）
6. 本番 CORS 設定で `*` を指定すると起動時に例外が投げられる
7. `SESSION_SECRET` が `env.ts` の Zod スキーマで検証され、`ServerEnv` 型に含まれる
8. `server/.env.example` に `SESSION_SECRET` が `# REQUIRED in production` 付きで記載される

## 4. 設計方針

### 4-1. Content-Security-Policy

`server/src/config/security.ts` の `buildSecurityHeaders()` に CSP を追加する。

サーバーは JSON API として機能し HTML/スクリプトを配信しないため、`default-src 'none'` が適切。
この値はすべてのリソース取得を禁止し、API レスポンスを誤ってレンダリングしても
スクリプト・スタイルが読み込まれないことを保証する。

```
Content-Security-Policy: default-src 'none'
```

### 4-2. SESSION_SECRET の Zod 統一

現状: `app.ts` の `createApp()` 内で `process.env.SESSION_SECRET` を直接読む。
変更後: `env.ts` の `EnvSchema` に追加し、`ServerEnv.sessionSecret` として返す。
`server.ts` が `env.sessionSecret` を `security.sessionSecret` として `createApp()` へ渡す。
`app.ts` は `security.sessionSecret` を読む（`process.env` 直読みを廃止）。

### 4-3. 本番 CORS `*` バリデーション

`createApp()` 内で `NODE_ENV=production` かつ `corsAllowedOrigins` に `"*"` が含まれる場合、
起動時に例外を投げる。開発・テスト環境では `*` を許可する（開発便宜のため）。

### 4-4. `.env.example` 更新

`SESSION_SECRET` の説明と `DATABASE_URL` が本番で必須であることを明記する。

## 5. 影響範囲

- `server/src/config/security.ts` — CSP ヘッダ追加
- `server/src/middleware/secureHeaders.test.ts` — CSP テスト追加
- `server/src/config/env.ts` — SESSION_SECRET 追加
- `server/src/app.ts` — SESSION_SECRET 読み取り元変更、CORS `*` バリデーション追加
- `server/src/server.ts` — SESSION_SECRET 渡し
- `server/.env.example` — SESSION_SECRET 追記

## 6. テスト計画（TDD）

1. `secureHeaders.test.ts`: CSP ヘッダが `default-src 'none'` で付与されることを確認
2. `env.test.ts`（新規）: `SESSION_SECRET` が `ServerEnv` に含まれることを確認
3. `app.test.ts` 相当: 本番 CORS `*` で起動時例外が投げられることを確認

## 7. リスク・未決事項

- `default-src 'none'` の CSP は将来サーバーが HTML を配信するようになった際に見直しが必要
- `SESSION_SECRET` を `SecurityOptions` に追加するとテストコードに影響があるが、オプショナルなので既存テストは無変更で通る
