# セットアップ / 環境変数ガイド

ローカル開発・CI/CD・本番での環境変数の扱いをまとめる。各ワークスペースの環境変数は
**Zod スキーマで検証**され、不正値は起動時（server はプロセス起動時、client はアプリ初期化時）に
エラーになる。

## ローカル開発（`.env.local` の作り方）

各ワークスペースの `.env.example` をコピーして実値を埋める。`.env` / `.env.*` は
`.gitignore` 対象（`.env.example` のみコミットする）。

```sh
# server
cp server/.env.example server/.env        # DATABASE_URL などを設定（DB 手順は README 参照）

# client
cp client/.env.example client/.env.local  # 通常はデフォルトのままでよい（同一オリジン）
```

> client は Vite の規約に従い `.env.local`（git ignore）に値を置く。`VITE_` 接頭辞の変数のみ
> ブラウザへ公開される。

## server の環境変数

`server/src/config/env.ts`（`loadEnv`）が検証する。詳細は `server/.env.example` を参照。

| 変数                   | 必須  | 既定    | 説明                                                  |
| ---------------------- | :---: | ------- | ----------------------------------------------------- |
| `DATABASE_URL`         | 任意※ | —       | Prisma / PostgreSQL 接続先。DB を使う機能では実質必須 |
| `PORT`                 | 任意  | `3000`  | Express API の待受ポート                              |
| `RATE_LIMIT_WINDOW_MS` | 任意  | `60000` | レート制限のウィンドウ長（ms, #34）                   |
| `RATE_LIMIT_MAX`       | 任意  | `300`   | ウィンドウあたりの IP ごと最大リクエスト数（#34）     |
| `REQUEST_BODY_LIMIT`   | 任意  | `100kb` | リクエストボディ上限（#34）                           |
| `REQUEST_TIMEOUT_MS`   | 任意  | `30000` | リクエストタイムアウト（ms, #34）                     |
| `CORS_ALLOWED_ORIGINS` | 任意  | （空）  | 許可オリジン（カンマ区切り, #35）                     |

※ `DATABASE_URL` は Zod 上は optional だが、DB 永続化を伴う機能では設定が前提。

## client の環境変数

`client/src/config/env.ts`（`loadClientEnv`）が検証する。詳細は `client/.env.example` を参照。

| 変数                | 必須 | 既定                 | 説明                                                                                                                                |
| ------------------- | :--: | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | 任意 | （空＝同一オリジン） | server API のベース URL。未設定なら同一オリジン相対で呼ぶ（dev は Vite proxy）。クロスオリジン配信（#78）で Cloud Run の URL を設定 |
| `VITE_LOG_LEVEL`    | 任意 | `info`               | `debug` / `info` / `warn` / `error`                                                                                                 |

## CI/CD での環境変数注入

- **CI（テスト/lint/build）**: `.github/workflows/ci.yml` は `.env` を使わない。統合テスト
  （`*.int.test.ts`）は `DATABASE_URL` 未設定時にスキップされる既存挙動を維持する。
- **本番/開発デプロイ**: 機密値は **GitHub Secrets** で管理し、コードに平文で置かない。
  GitHub Actions の `env:` / `with:` 経由でビルド・デプロイへ注入する。
  - server（Cloud Run）/ client（Cloudflare Pages）の実デプロイパイプラインと、設定すべき
    Secrets の一覧・クラウド側の準備手順は **Issue #78（`docs/deploy/setup.md`）が一括で定義**する。
    本ガイドはアプリ側の env スキーマ（上記表）を正本とする。

## 関連

- DB セットアップ手順: [README.md](../README.md#db-セットアップserver)
- ADR-0006（client ↔ server の型共有・同一オリジン方針）: `docs/adr/0006-*.md`
- デプロイ基盤と Secrets 運用: Issue #78
