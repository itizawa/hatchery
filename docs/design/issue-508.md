# 設計書: Issue #508 CI に Turborepo Remote Caching を導入する

## 目的

CI（`.github/workflows/ci.yml`）の `pnpm turbo run lint test build` で Turborepo Remote Cache を有効化し、入力に変更のないタスク（lint/test/build）のキャッシュを **CI 実行間で共有**する。これにより典型的な PR（一部ワークスペースのみ変更）で未変更ワークスペースの再計算をスキップし、CI リードタイムと Actions 分を削減する。

## 受け入れ条件 → 入出力への落とし込み

| #   | 受け入れ条件                                                              | 検証方法（このPRでの担保）                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CI で Remote Cache が有効になりキャッシュヒット時にタスクがスキップされる | `ci.yml` に `TURBO_TOKEN` / `TURBO_TEAM` を turbo 実行ステップへ渡す env を追加。リポジトリ規約テストでこの env 注入を検証。実機ヒットは Secrets 設定後に CI ログ（`FULL TURBO` / `cache hit, replaying logs`）で観測（設計書に観測手順を記載）。                       |
| 2   | バックエンドを設計書で選定・採用（Secrets 経由）                          | 本設計書で **Vercel Remote Cache** を採用。認証情報は GitHub Secrets（`TURBO_TOKEN`/`TURBO_TEAM`）経由でのみ渡し、平文を残さない。                                                                                                                                      |
| 3   | キャッシュキーが正しく機能し入力変更タスクは再実行                        | `turbo.json` の各タスク `outputs` を点検。`lint`/`test` は出力レス（成否のみキャッシュ）で妥当、`build` 系は `dist/**` 等を網羅。turbo は既定で root `pnpm-lock.yaml`・`turbo.json`・`package.json` をグローバル入力に含むため、`globalDependencies` の明示追加は不要。 |
| 4   | 既存 CI ゲートの正しさが損なわれない                                      | Remote Cache はタスクの**成功結果のみ**を再生する。失敗タスクはキャッシュされない（turbo の仕様）。よってキャッシュヒットしても fail すべき変更は再実行され fail する。                                                                                                 |
| 5   | 設定手順を docs/ADR に記録                                                | ADR-0002 を Remote Caching 追補で改訂し、README 一覧の説明を更新。設定手順（必要 Secrets・env）を本設計書と ADR に記載。                                                                                                                                                |
| 6   | ローカル（未設定環境）でも従来どおり緑                                    | `TURBO_TOKEN`/`TURBO_TEAM` 未設定時は turbo がローカルキャッシュにフォールバック（Remote は no-op）。`ci.yml` の env は Secrets 由来で未設定なら空文字となり Remote は無効化されるだけ。`turbo.json` 自体に Remote 固有設定は書かない（環境変数駆動）。                 |

## 設計判断

### バックエンド: Vercel Remote Cache を採用

- GitHub-hosted ランナー前提。**セットアップ負荷が最小**（サーバ構築不要）で、turbo 公式が標準サポートする。
- 認証は `TURBO_TOKEN`（Vercel のアクセストークン）と `TURBO_TEAM`（チーム slug）を **GitHub Secrets** で CI に注入。リポジトリに平文を残さない。
- セルフホスト互換（`ducktors/turborepo-remote-cache`）は別途サーバ運用が必要でコスト過大なため不採用。

### `ci.yml` への注入方法

`turbo run` を実行するステップ（および将来の turbo 実行ステップ）に env を付与する。job レベルでまとめて定義し、turbo を呼ぶ全ステップで共有する。

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

- `TURBO_TOKEN` は機密のため **Secrets**。`TURBO_TEAM` はチーム slug（機密でない）だが運用簡便のため **Variables**（`vars`）で渡す。両方未設定時は空文字 → turbo は Remote を無効化しローカルキャッシュにフォールバック（受け入れ条件 #6）。
- turbo は `--remote-only` を付けない（ローカル + リモート両方を使う既定）。CI ランナーはエフェメラルなのでローカルヒットは期待できず、実質リモート主体になる。

### `turbo.json` の `outputs` 点検

- `lint`・`test`（および `@hatchery/server#test`）: 出力ファイルを持たず**成否のみキャッシュ**。これは妥当（カバレッジ生成は各 WS の test script 側で行うが、CI のカバレッジステップは Issue #507 で turbo test に統合済み or 別管理。本 Issue では outputs 追加はしない）。
- `build` / `@hatchery/server#build` / `@hatchery/client#build` / `storybook:build`: `dist/**`・`storybook-static/**` を網羅済み。
- `openapi`（`openapi.json`）・`gen-types`（`src/api/openapi.gen.ts`）・`gen-field-specs`（`src/generated/**`）: 生成物を outputs 宣言済みで Remote Cache 対象として妥当。
- `db:generate`・`dev`: `cache: false` で対象外（正しい）。
- 結論: **既存 `outputs` 定義は Remote Cache 対象として妥当で不足なし**。誤キャッシュ防止のため `turbo.json` は変更しない（過剰変更を避ける）。

### キャッシュキーの健全性（受け入れ条件 #3）

turbo はタスクのハッシュに「タスクのソース入力 + 依存タスクのハッシュ + グローバル入力（root の `pnpm-lock.yaml`・`turbo.json`・`package.json` など）+ 関連 env」を含める。ロックファイルが変わればグローバルハッシュが変わり全タスクが再実行される。本 PR では既定挙動に委ね、明示の `globalDependencies` 追加は不要（既定で lockfile を含む）。

## 観測手順（Secrets 設定後・人間または CI で確認）

1. GitHub リポジトリ Settings → Secrets に `TURBO_TOKEN`、Variables に `TURBO_TEAM` を登録する。
2. 同一内容の PR を 2 回 push（または再実行）し、2 回目の `Lint / Test / Build` ログに `cache hit, replaying logs` / `>>> FULL TURBO` が出ることを確認する。
3. 1 ワークスペースだけ変更した PR で、変更 WS は再実行・未変更 WS はヒットすることを確認する。

> Secrets 未登録の現状でも turbo はローカルフォールバックで動くため CI は緑（受け入れ条件 #6）。Remote の実効化は Secrets 登録後に有効化される。

## 変更ファイル

- `.github/workflows/ci.yml` — job に `env`（`TURBO_TOKEN`/`TURBO_TEAM`）を追加。
- `docs/adr/0002-package-manager-and-build-tooling.md` — Remote Caching 追補（改訂履歴 + 節追加）。
- `docs/adr/README.md` — 0002 の説明を最新化（任意）。
- `tests/ci-remote-cache.test.ts` — Remote Cache 用 env 注入のリポジトリ規約テスト（新規）。

## スコープ外

- デプロイ系 workflow への Remote Cache 適用（CI ゲート優先のため本 Issue では必須としない）。
- CI での PostgreSQL 起動・統合テスト（別 Issue）。
- ユーザー可視の振る舞いは変わらないため `e2e/` の usecases 更新は不要。
