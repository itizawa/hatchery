# 設計書: Issue #507 CI のテスト2重実行を解消し coverage を単一実行に統合する

## 背景・目的

現状の `.github/workflows/ci.yml` は次の2段でテストを実行しており、common/server/client の各テストが
**CI 1 実行あたり 2 回ずつ**走っている。

1. `Lint / Test / Build`: `pnpm turbo run lint test build`（turbo の `test` タスクで全 WS の `vitest run`）
2. `Test with coverage (common/server/client)`: WS ごとに `pnpm exec vitest run --coverage` を再実行

この重複を解消し、**カバレッジ付きの単一実行**に統合する。#71 で導入したカバレッジ生成・artifact
アップロード・PR カバレッジコメントは維持する。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 検証（テスト） |
|---|---|---|
| 1 | common/server/client の各テストが CI 1 実行あたり 1 回だけ走る | `ci-workflow.test.ts`: ci.yml に `vitest run --coverage` を直接呼ぶ「2 重実行」ステップが存在しないこと（`Test with coverage` ステップ群が消えていること）を検証 |
| 2 | カバレッジ生成・artifact・PR コメントが従来どおり機能 | `vitest-coverage-config.test.ts`: 各 WS の vitest 設定に v8/lcov/json-summary/thresholds が残り、ci.yml に upload-artifact / vitest-coverage-report-action が残ること。各 WS の `test` script が `--coverage` を含むこと |
| 3 | 統合方法を明示し選定理由を述べる | 本書（下記「設計判断」） |
| 4 | `DATABASE_URL` 未設定で `.int.test.ts` が skipIf でスキップ | 既存挙動を変更しない（vitest 設定・テストの skipIf を触らない） |
| 5 | ローカルの `turbo run build\|test\|lint` が緑のまま | ローカルで `pnpm turbo run lint test build` を実行して確認 |

## 設計判断: 統合方法（受け入れ条件 #3）

受け入れ条件 #3 の選択肢のうち **「turbo の `test` タスク自体をカバレッジ付き（`vitest run --coverage`）に
寄せて単一化する」（Option A）** を採用する。

### 具体策

- 各ワークスペースの `package.json` の `test` script を `vitest run` → `vitest run --coverage` に変更。
  - これにより `pnpm turbo run test`（= CI の `Lint / Test / Build`）の中で各 WS のカバレッジが生成される。
- `ci.yml` から `Test with coverage (common/server/client)` の 3 ステップを削除する。
  - turbo の `test` 実行ですでに `coverage/` が生成されるため、2 重実行が解消される。
- `upload-artifact`（`coverage-common`/`coverage-server`/`coverage-client`）と
  `davelosert/vitest-coverage-report-action`（PR コメント）はそのまま残す。
  これらは turbo test が生成した `coverage/` を参照するだけで従来どおり機能する。
- `turbo.json` の `test` 系タスクに `outputs: ["coverage/**"]` を追加し、生成された
  カバレッジを turbo のキャッシュ対象に含める（キャッシュヒット時も artifact 用 coverage が復元される）。

### Option B（turbo の test を外し coverage 実行に一本化）を採らない理由

- ci.yml を WS 別に手書きするより、turbo の依存順（`^build` / `@hatchery/server#db:generate`）解決に
  乗せたほうが、受け入れ条件 3 の「`@hatchery/server#test` が依存する `^build` / `db:generate` 相当が
  満たされた状態でテストが走る」前提を turbo.json の既定で自動的に満たせる。
- Option B では coverage 実行が turbo の依存グラフ外になり、server の build/db:generate 前提を
  ci.yml 側で再現する必要が生じ、turbo.json と CI の二重管理になる。
- Option A は「`test` の定義そのもの」を単一の正本にでき、ローカルでも `pnpm test` でカバレッジが出る。

### `@hatchery/server#test` の前提（受け入れ条件 #3 後段）

`turbo.json` で `@hatchery/server#test` は `["^build", "@hatchery/server#db:generate"]` に依存済み。
`test` script を `vitest run --coverage` に変えてもタスク ID（`test`）は不変なので、この依存関係は
維持される。よって coverage 付きでも build / db:generate 前提が満たされた状態で server テストが走る。

## 影響範囲

- `client/package.json` `server/package.json` `common/package.json`: `test` script を `--coverage` 付きに。
- `.github/workflows/ci.yml`: `Test with coverage (*)` の 3 ステップを削除。コメントを更新。
- `turbo.json`: `test` / `@hatchery/server#test` の `outputs` に `coverage/**` を追加。
- `tests/ci-workflow.test.ts` / `tests/vitest-coverage-config.test.ts`: 新仕様に合わせて spec を更新。

## ユーザー可視の振る舞い

CI 内部の最適化のみ。プロダクトのユーザー可視の振る舞いは変わらないため `e2e/` の更新は不要。

## スコープ外

CI での PostgreSQL 起動・統合テスト実行（別 Issue）、Turborepo Remote Caching（別 Issue）。
</content>
</invoke>
