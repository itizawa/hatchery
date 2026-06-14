# 設計書: GitHub Actions の各 action を Node.js 24 対応バージョンへ更新する (#465)

## 1. 目的 / 背景

GitHub Actions ランナーから Node.js 20 が 2026-06-16 に強制廃止される。
`.github/workflows/` 配下の各ワークフローが Node.js 20 ベースの action を使用しており、
実行ログに廃止警告が出ている。Node.js 24 対応の最新安定バージョンへ更新することで
2026-09-16 の Node.js 20 完全削除後も警告なく動作し続ける状態にする。

## 2. スコープ（やること / やらないこと）

### やること
- `.github/workflows/` 配下の全 action を Node.js 24 対応の最新メジャーバージョンへ更新
- 各 action の `with:` パラメータ互換性を確認し、非互換なら追従

### やらないこと
- アプリコード（client / server / common）の変更
- `actions/upload-pages-artifact` / `actions/deploy-pages` のアップグレード
  （理由: 2026-06-14 時点で Node.js 24 対応版のリリースが未確認。composite action のため
  内部で使う upload-artifact の更新が先決。これらのアップグレードは別 Issue で対応。）
- `davelosert/vitest-coverage-report-action@v2` のアップグレード
  （理由: v2 が現行最新かつ package.json の `@types/node` が v24 で Node.js 24 対応済み。）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 以下の action が Node.js 24 対応バージョンに更新されている:
   - `actions/checkout@v4` → `@v5`
   - `actions/setup-node@v4` → `@v5`
   - `pnpm/action-setup@v4` → `@v6`
   - `google-github-actions/auth@v2` → `@v3`
   - `google-github-actions/setup-gcloud@v2` → `@v3`
   - `actions/upload-artifact@v4` → `@v6`
2. `grep -rn "uses:" .github/workflows/` の結果に `@v4` 以下（Node.js 20 ベース）の
   checkout / setup-node / pnpm/action-setup / google-github-actions/auth / setup-gcloud /
   upload-artifact が残っていない
3. 既存の `with:` パラメータが新バージョンで動作する
   （checkout の `fetch-depth`、setup-node の `node-version-file: .nvmrc` + `cache: pnpm`、
   auth の `workload_identity_provider` + `service_account`）
4. `pnpm test:repo` が緑（YAML 構文テスト）

## 4. 設計方針

- **一括 sed 置換ではなくファイルごとに確認しながら更新** — パラメータ互換性を担保するため。
- **google-github-actions/auth@v3 のパラメータ互換性**:
  `workload_identity_provider` と `service_account` は v3 でも継続サポート。
  v3 での主な変更は Node.js 24 ランタイムへの移行と、旧来の非推奨パラメータの削除。
  現在の使用パラメータは影響を受けない。
- **google-github-actions/setup-gcloud@v3**: 現在パラメータなしで使用のため互換性問題なし。
- **pnpm/action-setup@v6**: パラメータなしの使用（`packageManager` フィールドから自動解決）。
  v6 でも同動作を継続。
- **actions/upload-artifact@v6**: `name`、`path`、`retention-days` は v6 でも同様にサポート。

## 5. 影響範囲 / 既存への変更

- `.github/workflows/*.yml` の action バージョン文字列のみ変更
- アプリコード（client / server / common）への変更なし
- CI のテスト結果・ビルド成果物に変更なし（動作は同一）

## 6. テスト計画（TDD で書くテスト一覧）

この Issue はワークフロー YAML の文字列置換であり、通常の TDD サイクル（コードの単体テスト）は適用しない。
代わりに以下でバリデーションする:

1. `pnpm test:repo` — `tests/` 配下のリポジトリ規約テスト（YAML パース含む）が緑
2. `grep -rn "uses:" .github/workflows/` で残存する旧バージョンがないことを確認

## 7. リスク・未決事項

- `actions/upload-pages-artifact` と `actions/deploy-pages` の Node.js 24 対応版がリリース待ち。
  deploy-storybook.yml では引き続きこれら 2 action の Node.js 20 廃止警告が残る可能性がある。
  対応は各 action の upstream リリース後に別 Issue で行う。
