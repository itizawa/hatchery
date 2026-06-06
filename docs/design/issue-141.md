# 設計書: Deploy Client (dev) が pnpm workspace で wrangler を解決できずデプロイ失敗する (#141)

## 1. 目的 / 背景

`Deploy Client (dev)`（`.github/workflows/deploy-client-dev.yml`）が develop への push で失敗し続けている。原因は Cloudflare のシークレット未設定ではなく、`cloudflare/wrangler-action@v3` と pnpm workspace の相性問題:

```
[command]/home/runner/setup-pnpm/node_modules/.bin/pnpm exec wrangler --version
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "wrangler" not found
⚠️ Wrangler not found or version is incompatible. Installing...
[command]/home/runner/setup-pnpm/node_modules/.bin/pnpm add wrangler@3.90.0
 ERR_PNPM_ADDING_TO_ROOT  Running this command will add the dependency to the workspace root ...
##[error]The process '/home/runner/setup-pnpm/node_modules/.bin/pnpm' failed with exit code 1
```

wrangler-action は wrangler が見つからないと `pnpm add` で動的インストールを試みるが、pnpm workspace のルートへの追加がブロックされて失敗する。シークレットを投入しても、この箇所を直さない限り Client deploy は緑にならない。

## 2. スコープ（やること / やらないこと）

### やること
- `wrangler` を `client` の devDependency としてバージョン固定で追加し、pnpm-lock.yaml を更新する。
- `deploy-client-dev.yml` のデプロイステップを `cloudflare/wrangler-action` から `pnpm exec wrangler pages deploy` の直接実行に置き換える（動的インストールを排除）。
- Cloudflare 認証情報（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）を env 経由で wrangler に渡す。

### やらないこと
- Server 側（`Deploy Server (dev)`）の修正（GCP シークレット未設定が原因＝人間タスク。スコープ外）。
- GCP / Cloudflare のシークレット投入そのもの（人間タスク）。
- デプロイの実体（出力 `client/dist/web` を `--project-name=hatchery` で Direct Upload）の変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/package.json` の `devDependencies` に `wrangler` がバージョン固定（空でない文字列）で含まれる。
2. `deploy-client-dev.yml` は `cloudflare/wrangler-action` を**使わない**（= raw に当該文字列を含まない）。
3. `deploy-client-dev.yml` のデプロイステップが `pnpm exec wrangler pages deploy` を実行する（動的インストールに依存しない）。
4. デプロイステップが `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を `secrets.*` から env 経由で wrangler に渡す。
5. デプロイの実体は不変: ビルド出力 `dist/web` を `--project-name=hatchery` でデプロイし、`VITE_API_BASE_URL` を `vars.CLOUD_RUN_DEV_URL` から渡す。トリガーは develop の push のみ（main 非トリガー）。
6. 既存テスト `tests/deploy-client-workflow.test.ts` が引き続きパスする。
7. `pnpm test` / `pnpm lint` が緑。

## 4. 設計方針

- **wrangler-action を廃止し CLI 直接実行に変更**。wrangler を client のローカル依存として固定することで、`pnpm exec wrangler` が確実に解決され、wrangler-action の「未検出 → 動的インストール」経路自体が消える。これが ERR_PNPM_ADDING_TO_ROOT の根治。
- デプロイステップは `working-directory: client` で実行し、`pnpm exec wrangler pages deploy dist/web --project-name=hatchery` とする。`client/wrangler.toml`（`name = "hatchery"` / `pages_build_output_dir = "dist/web"`）が同ディレクトリで参照される。
- wrangler は CLI 引数の `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 環境変数を自動で読むため、`env:` で `secrets.*` を渡す。
- バージョンは動的インストールが要求していた `wrangler@3.90.0` 系に合わせ `^3.90.0` を固定（compatibility_date 2025-01-01 と整合する v3 系）。

## 5. 影響範囲 / 既存への変更

- `client/package.json`（devDependencies に wrangler 追加）
- `pnpm-lock.yaml`（lockfile 更新。`--frozen-lockfile` の CI で必要）
- `.github/workflows/deploy-client-dev.yml`（デプロイステップ置換）
- `tests/deploy-client-workflow.test.ts`（受け入れ条件のテスト追加）
- 対象ワークスペース: client / （ルート lockfile）/ CI

## 6. テスト計画（TDD で書くテスト）

`tests/deploy-client-workflow.test.ts` に Issue #141 用の describe を追加:
- `client/package.json` の devDependencies に wrangler が固定されている。
- workflow が `cloudflare/wrangler-action` を含まない。
- workflow のデプロイステップが `pnpm exec wrangler pages deploy` を実行する。
- デプロイステップの env に `secrets.CLOUDFLARE_API_TOKEN` / `secrets.CLOUDFLARE_ACCOUNT_ID` が渡る。

既存テスト（トリガー・VITE_API_BASE_URL・secrets 参照・pnpm build ステップ・wrangler.toml・setup.md）は変更せず維持する。

## 7. リスク・未決事項

- wrangler-action が提供していた付随機能（デプロイ URL の output 等）は使っていないため、CLI 直接実行への移行で失われる機能はない。
- 実際の Cloudflare への到達はシークレット投入後（人間タスク）に初めて検証可能。本 Issue では「pnpm workspace で wrangler が解決される・動的インストールしない」ことをワークフロー定義と依存関係のレベルで保証する。
