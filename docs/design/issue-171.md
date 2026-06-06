# 設計書: ci: develop デプロイ時に GitHub Actions で Prisma マイグレーションを自動適用する (#171)

## 1. 目的 / 背景

`.github/workflows/deploy-server-dev.yml` は Cloud Run (dev) へのデプロイを行うが、`prisma migrate deploy` が含まれていないため、新マイグレーション追加後も dev DB のスキーマが更新されず実行時エラーが発生する。develop へのマージと DB スキーマ反映を同期させる。

## 2. スコープ（やること / やらないこと）

**やること**
- `deploy-server-dev.yml` の deploy ジョブに `prisma migrate deploy` ステップを追加（`gcloud run deploy` より前）
- `tests/deploy-server-workflow.test.ts` にマイグレーション検証テストを追加

**やらないこと**
- `main`（本番）向けマイグレーション自動化
- ロールバック戦略・shadow DB・expand/contract ルールの整備
- 別ジョブ分離（same-job 方式で実装し、テストの ordering 検証を簡潔に保つ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `deploy-server-dev.yml` の steps 一覧に `pnpm --filter @hatchery/server db:migrate` を含むステップが存在する
2. そのステップが `gcloud run deploy` を含むステップより **前のインデックス** に位置する
3. そのステップの `env.DATABASE_URL` に `secrets.DATABASE_URL` が参照されている
4. 既存テスト（トリガー・WIF 認証・Cloud Run デプロイ・Dockerfile）が全て緑
5. `pnpm test:repo` および `pnpm turbo run lint test build` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**same-job 方式** を採用する。deploy ジョブ内に pnpm/Node セットアップ → 依存インストール → migration → Docker ビルド → Cloud Run デプロイ の順でステップを配置する。

理由:
- `allSteps()` ユーティリティ（テスト共通）がジョブをまたいだステップのフラット配列を返すため、同一ジョブのほうが index による順序検証が確実
- ジョブ分離より YAML の変更量が少なく、CI の追加権限設定も不要

ステップ追加位置: 「Set up Cloud SDK」と「Configure Docker for Artifact Registry」の間

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4

- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc

- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Run Prisma migration
  run: pnpm --filter @hatchery/server db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## 5. 影響範囲 / 既存への変更

- `.github/workflows/deploy-server-dev.yml`: ステップ追加のみ（トリガー・concurrency・WIF 認証は変更しない）
- `tests/deploy-server-workflow.test.ts`: describe ブロック追加のみ

## 6. テスト計画（TDD で書くテスト一覧）

`tests/deploy-server-workflow.test.ts` の末尾に追加:

```
describe("Prisma マイグレーション (受け入れ条件 #1-#3)")
  it("マイグレーション実行ステップが存在する")
  it("マイグレーションステップが gcloud run deploy より前に位置する")
  it("DATABASE_URL を secrets 経由で参照する")
```

## 7. リスク・未決事項

- dev DB が Cloud SQL 経由の場合、Cloud SQL Proxy の起動が必要になる可能性がある。ただし Issue では `secrets.DATABASE_URL` を直接使うよう指示されており、接続文字列が直接指定されていれば問題ない。
- pnpm install のキャッシュは今回追加しない（CI キャッシュと設定を統一することが望ましいが、スコープ外）。
