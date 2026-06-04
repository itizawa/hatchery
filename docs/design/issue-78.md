# 設計書: 開発環境デプロイパイプライン構築 (#78)

## 1. 目的 / 背景

CI（lint/test/build）は整っているが、実際に動くサーバに繋いで確認する環境がない。
`develop` ブランチへのマージをトリガーに自動デプロイが走る開発（dev）環境を構築し、
「動くものを触りながら確認する」開発ループを実現する。

## 2. スコープ（やること / やらないこと）

### やること

- `server/Dockerfile`（Node 26-alpine ベース、multi-stage ビルド）
- `server/.dockerignore`
- `.github/workflows/deploy-server-dev.yml`（develop push → Cloud Run デプロイ）
- `client/wrangler.toml`（Cloudflare Pages プロジェクト設定）
- `.github/workflows/deploy-client-dev.yml`（develop push → Cloudflare Pages デプロイ）
- `docs/adr/0011-server-hosting-cloud-run.md`（Cloud Run 採用の決定記録）
- `docs/deploy/setup.md`（ユーザー向け初期セットアップ手順書）

### やらないこと

- 本番環境（main ブランチ）へのデプロイ（別 Issue）
- Cloud Run や Cloudflare Pages の実リソース作成（人間が手動セットアップ）
- Secret Manager の利用（MVP では環境変数直接渡し）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `deploy-server-dev.yml` が存在し、valid YAML で `develop` push をトリガーにする
2. `deploy-client-dev.yml` が存在し、valid YAML で `develop` push をトリガーにする
3. `deploy-client-dev.yml` が VITE_API_BASE_URL をビルド変数として使用する
4. 両ワークフローでシークレットは `${{ secrets.* }}` 参照のみ（平文なし）
5. `docs/deploy/setup.md` が存在する
6. `server/Dockerfile` が存在し `FROM node:26` ベースである
7. `docs/adr/0011-*.md` が存在し MADR 必須セクションと Cloud Run / Cloudflare Pages 記述を含む
8. `docs/adr/README.md` に 0011 の行が追加されている

## 4. 設計方針

### server デプロイ（Cloud Run）

- **認証**: Workload Identity Federation（サービスアカウントキーを使わない）
- **イメージ**: Google Artifact Registry に push → Cloud Run に deploy
- **Dockerfile**: multi-stage ビルド（builder で `pnpm build` → runner で本番依存のみ）
  - monorepo 構造のため、`common` と `server` のみコピーする
  - `pnpm install --filter @hatchery/server...` で server と依存（common）のみインストール
- **スケール**: `--min-instances=0 --max-instances=3`（開発環境のコスト節約）
- **ポート**: 8080（Cloud Run のデフォルト。server は `PORT` 環境変数から取得）

### client デプロイ（Cloudflare Pages）

- **ツール**: `wrangler pages deploy`（`cloudflare/wrangler-action@v3`）
- **ビルド**: `pnpm turbo run build --filter=@hatchery/client`
- **VITE_API_BASE_URL**: GitHub Actions の `vars.CLOUD_RUN_DEV_URL`（repository variable）から渡す
- **wrangler.toml**: `name` と `pages_build_output_dir` を定義し、プロジェクト名を統一

### ADR 番号

0011（0010 の次）= `docs/adr/0011-server-hosting-cloud-run.md`

## 5. 影響範囲

- 新規ファイル: `server/Dockerfile`, `server/.dockerignore`, `.github/workflows/deploy-server-dev.yml`,
  `client/wrangler.toml`, `.github/workflows/deploy-client-dev.yml`,
  `docs/adr/0011-server-hosting-cloud-run.md`, `docs/deploy/setup.md`
- 更新ファイル: `docs/adr/README.md`（0011 行追加）
- 既存コードへの変更なし（設定・ドキュメントのみ）

## 6. テスト計画

- `tests/deploy-server-workflow.test.ts`: deploy-server-dev.yml の構造検証
- `tests/deploy-client-workflow.test.ts`: deploy-client-dev.yml の構造検証
- `tests/adr-cloud-run-hosting.test.ts`: ADR-0011 の体裁・内容検証

## 7. リスク・未決事項

- `PORT` 環境変数の扱い: `server/src/config/env.ts` の `loadEnv()` が `PORT` を参照しているか確認が必要。
  Cloud Run はデフォルト 8080 番でポートをコンテナに渡すため、`PORT=8080` を環境変数として設定する。
- `prisma migrate deploy` の実行タイミング: Dockerfile の CMD または Cloud Run の startup probe 前に実行する必要があるが、本 Issue では CMD に含めるシンプルな方式を採用する。
