# 設計書: main ブランチ → 本番環境（Cloud Run + Cloudflare Pages）CI/CD パイプラインを整備する (#345)

## 1. 目的 / 背景

`develop` → dev 環境のデプロイは自動化済みだが、`main` → 本番環境のパイプラインが存在しない。
v1.2.0 からの本番リリースを安全・確実に自動化するため、本番デプロイワークフローを整備する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `.github/workflows/deploy-server-prod.yml` 新規作成
- `.github/workflows/deploy-client-prod.yml` 新規作成
- `docs/deploy/setup.md` に本番環境 Secrets 一覧を追記
- 上記ワークフローを検証するリポジトリ規約テストを追加

**やらないこと:**
- 既存 dev ワークフローへの変更
- ブルーグリーンデプロイ / カナリアリリース / ロールバック自動化
- GCP 本番環境の実構築（本 PR はワークフロー定義のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `deploy-server-prod.yml` が存在し valid YAML であること
2. `deploy-server-prod.yml` のトリガーが `main` push であること
3. `deploy-server-prod.yml` で Prisma マイグレーションがデプロイより前に実行されること
4. `deploy-server-prod.yml` で Cloud Run サービス名が `hatchery-prod` であること
5. `deploy-server-prod.yml` で WIF 認証（id-token: write + google-github-actions/auth）が設定されていること
6. `deploy-server-prod.yml` で `DATABASE_URL_PROD` を使用していること
7. `deploy-client-prod.yml` が存在し valid YAML であること
8. `deploy-client-prod.yml` のトリガーが `main` push であること
9. `deploy-client-prod.yml` で `CLOUD_RUN_PROD_URL` を `VITE_API_BASE_URL` に使用していること
10. `deploy-client-prod.yml` で `wrangler pages deploy ... --branch main` が実行されること
11. `docs/deploy/setup.md` に本番環境の Secrets 一覧が記載されていること
12. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `deploy-server-prod.yml`
- `deploy-server-dev.yml` をベースに、以下を変更:
  - `on.push.branches: [main]`
  - `SERVICE_NAME: hatchery-prod`
  - `concurrency.group: deploy-server-prod`
  - マイグレーション `DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}`
  - Cloud Run env vars の `DATABASE_URL` = `${{ secrets.DATABASE_URL_PROD }}`
- WIF 認証・Docker ビルド・pnpm 設定は dev と同一

### `deploy-client-prod.yml`
- `deploy-client-dev.yml` をベースに、以下を変更:
  - `on.push.branches: [main]`
  - `concurrency.group: deploy-client-prod`
  - ビルド `VITE_API_BASE_URL: ${{ secrets.CLOUD_RUN_PROD_URL }}`
  - `wrangler pages deploy dist/web --project-name=hatchery --branch main`
- pnpm ビルド・wrangler 実行は dev と同一パターン

### テスト
- `tests/deploy-server-prod-workflow.test.ts` — dev の対応テストを参考に prod 固有条件を検証
- `tests/deploy-client-prod-workflow.test.ts` — dev の対応テストを参考に prod 固有条件を検証

## 5. 影響範囲 / 既存への変更

- `.github/workflows/` — 新規 2 ファイル追加のみ（既存変更なし）
- `docs/deploy/setup.md` — 本番 Secrets セクション追記
- `tests/` — 新規テスト 2 ファイル追加
- `client/`・`server/`・`common/` — 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

**`tests/deploy-server-prod-workflow.test.ts`**
1. ファイルが存在する / valid YAML
2. main push をトリガーにする
3. develop をトリガーにしない
4. id-token: write 権限が設定されている
5. google-github-actions/auth で WIF 認証する
6. secrets 経由でのみ認証情報を参照する（DATABASE_URL_PROD 含む）
7. gcloud run deploy コマンドが含まれる
8. Cloud Run サービス名が hatchery-prod
9. Docker ビルド・push ステップが含まれる
10. Prisma マイグレーションステップがデプロイより前に存在する
11. DATABASE_URL_PROD を secrets 経由で参照する

**`tests/deploy-client-prod-workflow.test.ts`**
1. ファイルが存在する / valid YAML
2. main push をトリガーにする
3. develop をトリガーにしない
4. VITE_API_BASE_URL に CLOUD_RUN_PROD_URL が使われる
5. Cloudflare API token / account ID を secrets 経由で参照する
6. wrangler pages deploy が含まれる
7. pnpm exec wrangler で実行する
8. --branch main が指定されている
9. pnpm ビルドステップが含まれる

## 7. リスク・未決事項

- 本番 Artifact Registry / Cloud Run サービスの実構築は別作業（本 PR はワークフロー定義のみ）
- prod 環境の SESSION_SECRET / ANTHROPIC_API_KEY / CORS_ALLOWED_ORIGINS は dev と共用可能だが、本番専用 Secret を別途作成することが望ましい（docs に注記する）
