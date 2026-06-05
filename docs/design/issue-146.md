# 設計書: Cloudflare Pages の開発環境に Basic 認証をかけて一般公開を防ぐ (#146)

## 1. 目的 / 背景

`develop` への push で client（Vite SPA）が Cloudflare Pages（dev 環境）へ自動デプロイされているが、
dev URL が認証なしで誰でもアクセスできる状態。
開発中の画面・データを不特定多数に晒さないよう、Cloudflare Pages Functions の `_middleware.ts` で
HTTP Basic 認証を実装して関係者のみアクセスできるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/functions/_middleware.ts`（Cloudflare Pages Functions）でリクエスト全体に Basic 認証を適用
- 資格情報検証の純粋ロジック（`client/functions/basicAuth.ts`）を切り出して Vitest でテスト
- 資格情報は Cloudflare Pages の環境変数（`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`）で注入
- タイミング攻撃に配慮した定数時間比較の実装
- `docs/deploy/setup.md` に設定手順を追記

**やらないこと**
- API サーバ（Cloud Run）のアクセス制御（別 Issue のスコープ）
- 本番環境（`main` デプロイ）への Basic 認証適用（env var 未設定でスキップする設計で対応）
- Cloudflare Access による認証（Pages Functions 方式を採用）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `Authorization` ヘッダ未指定のリクエストで `validateBasicAuth(null, user, pass)` が `false` を返す
2. フォーマット不正（`Basic` プレフィックス無し）で `false` を返す
3. 不正な Base64 文字列で `false` を返す
4. `:` を含まない decoded 値で `false` を返す
5. 正しい資格情報（`user:pass` の Base64）で `true` を返す
6. パスワード不一致で `false` を返す
7. ユーザ名不一致で `false` を返す
8. `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が未設定の場合、ミドルウェアは `next()` にそのまま通す

## 4. 設計方針

### 実装方式: Cloudflare Pages Functions `_middleware.ts`

- `client/functions/_middleware.ts` — Cloudflare Pages のミドルウェアとして全リクエストを補足
- `client/functions/basicAuth.ts` — `parseBasicAuth` / `validateBasicAuth` の純粋ロジック（Workers API 不使用）
- 定数時間比較: XOR ビット演算でタイミング攻撃を防ぐ
- 資格情報未設定の場合は `next()` をそのまま返す（本番環境では env var を設定しないことで無効化）

### wrangler との統合

- `wrangler pages deploy dist/web` 実行時、wrangler は `client/` に存在する `functions/` ディレクトリを
  自動的に Pages Functions として含める
- `wrangler.toml` に変更不要（`pages_build_output_dir = "dist/web"` は維持）

### テスト配置

- `client/functions/basicAuth.test.ts` を Vitest でテスト
- `vite.config.ts` の `test.include` に `functions/**/*.test.ts` を追加
- テスト環境は `node`（`@vitest-environment node` ドックブロックコメントで指定）

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `client/functions/_middleware.ts` | 新規作成 |
| `client/functions/basicAuth.ts` | 新規作成 |
| `client/functions/basicAuth.test.ts` | 新規作成 |
| `client/vite.config.ts` | `test.include` に `functions/**/*.test.ts` 追加 |
| `docs/deploy/setup.md` | Basic 認証の env var 設定手順を追記 |

## 6. テスト計画（TDD で書くテスト一覧）

`client/functions/basicAuth.test.ts` に以下を記述:

| テスト名 | 期待値 |
|----------|--------|
| Authorization ヘッダ未指定（null）→ false | `validateBasicAuth(null, "user", "pass")` → `false` |
| "Basic " プレフィックス無し → false | `validateBasicAuth("Bearer token", ...)` → `false` |
| 不正な Base64 → false | `validateBasicAuth("Basic !!!invalid!!!", ...)` → `false` |
| `:` を含まない decoded 値 → false | `validateBasicAuth("Basic " + btoa("nocoronhere"), ...)` → `false` |
| 正しい資格情報 → true | `validateBasicAuth("Basic " + btoa("user:pass"), "user", "pass")` → `true` |
| パスワード不一致 → false | `validateBasicAuth("Basic " + btoa("user:wrong"), "user", "pass")` → `false` |
| ユーザ名不一致 → false | `validateBasicAuth("Basic " + btoa("wrong:pass"), "user", "pass")` → `false` |
| パスワードに `:` を含む場合でも正しく解析 → true | `validateBasicAuth("Basic " + btoa("user:pass:with:colons"), "user", "pass:with:colons")` → `true` |

## 7. リスク・未決事項

- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を Cloudflare Pages の環境変数に設定する作業は人間が行う（本設計書の範囲外）
- 定数時間比較は文字列長が異なる場合に早期リターンするが、長さの違いはサイドチャネルになりうる。
  今回の用途（開発環境の覗き見防止）では許容範囲とする。
