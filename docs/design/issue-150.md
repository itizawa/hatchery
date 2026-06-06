# 設計書: pnpm を 10 系へアップグレードする (#150)

## 1. 目的 / 背景

現在 pnpm は 9.15.0 (`package.json` の `packageManager` が単一情報源)。
#148 でサプライチェーン対策として Renovate + リリースから約7日のクールダウンを導入したが、
pnpm ネイティブのインストール時クールダウン `minimumReleaseAge` は pnpm 10.16+ が必要で現行 9 系では使えない。
また pnpm 10 は依存パッケージのライフサイクルスクリプト（postinstall 等）をデフォルトで実行しないセキュリティ強化が入っており、
サプライチェーン観点でメリットが大きい。

## 2. スコープ（やること / やらないこと）

### やること
- `package.json` の `packageManager` を `pnpm@10.34.1` に更新する
- pnpm 10 のライフサイクルスクリプト既定無効化に対応する（`pnpm.onlyBuiltDependencies` を設定）
- `pnpm install` を再実行して `pnpm-lock.yaml` を pnpm 10 で再生成する
- Volta に pnpm を追加する（`volta.pnpm` フィールド）
- ADR-0002 を改訂して pnpm 10 採用の理由・影響を記録する

### やらないこと
- `minimumReleaseAge` の設定投入（pnpm 10 を「使える状態」にするまでが本 Issue のスコープ。実際の設定は #148 側）
- pnpm 10 以外の設定変更・パッケージ追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `package.json` の `packageManager` が `pnpm@10.34.1` になっている
- `pnpm-lock.yaml` が pnpm 10.34.1 で再生成されている（`lockfileVersion: '9.0'` 互換形式で差分最小）
- `pnpm.onlyBuiltDependencies` に必要なパッケージ（`@prisma/client`・`msw`・`prisma`・`sharp`・`workerd`）が設定されている
- `pnpm install --frozen-lockfile` が成功する（lockfile と package.json の整合）
- `turbo run lint test build` が緑（CI で確認）

## 4. 設計方針

### ライフサイクルスクリプトが必要なパッケージの特定

pnpm 10 ではデフォルトで全依存のライフサイクルスクリプトが無効化される。
調査の結果、以下のパッケージが `postinstall`/`install` スクリプトを持ちビルドに必要:

| パッケージ | スクリプト | 用途 |
|------------|-----------|------|
| `@prisma/client` | `postinstall: node scripts/postinstall.js` | `prisma generate` を実行して DB スキーマから型を生成する（server の build/test に必要） |
| `prisma` | CLI スクリプト | Prisma CLI として `prisma generate` を実行する |
| `msw` | `postinstall: node -e "import('./config/scripts/postinstall.js').catch(...)` | Mock Service Worker の service worker ファイルをセットアップする（テスト用）|
| `sharp` | `install: node install/check` | 画像処理ネイティブモジュール（`wrangler`/`miniflare` の optional 依存）|
| `workerd` | `postinstall: node install.js` | Cloudflare workerd バイナリのインストール（wrangler によるデプロイに必要） |

> 調査方法: `pnpm install --config.engine-strict=false` を実行し、pnpm 10 が出力する "Ignored build scripts" 警告の一覧を参照した。

これらを `package.json` の `pnpm.onlyBuiltDependencies` に列挙する。

### Volta への pnpm ピン

Volta はローカル環境での Node/pnpm 版ずれを防ぐ仕組み。
現状は Node のみ固定（`"volta": { "node": "26.2.0" }`）。
pnpm 10 採用を機に `"pnpm": "10.34.1"` を追加する。

### lockfile 形式

pnpm 9↔10 は `lockfileVersion: '9.0'` で互換。
再生成後も形式は変わらず、差分は依存の解決バージョン更新のみとなる見込み。

### ADR-0002 の改訂

pnpm メジャーバージョン変更は ADR-0002（パッケージマネージャ採用）の改訂事項。
追記内容:
- pnpm 10 への更新と理由（`minimumReleaseAge` スアポート、ライフサイクルスクリプト既定無効化のセキュリティ強化）
- `onlyBuiltDependencies` による明示的 allowlist の方針

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `package.json` | `packageManager` 更新・`pnpm.onlyBuiltDependencies` 追加・`volta.pnpm` 追加 |
| `pnpm-lock.yaml` | pnpm 10 で再生成 |
| `docs/adr/0002-package-manager-and-build-tooling.md` | pnpm 10 採用の改訂を追記 |

CI/CD ワークフロー（`pnpm/action-setup@v4`）は `packageManager` フィールドから自動的に pnpm 10 を使うため変更不要。

## 6. テスト計画

本 Issue はインフラ/設定変更のため単体テストは適用しない。
以下をもって受け入れ条件の検証とする:

1. **ローカル検証**: `pnpm install` が pnpm 10 で成功し lockfile が更新される
2. **CI 検証**: PR の CI (lint/test/build) が緑になること
3. **再現確認**: `pnpm install --frozen-lockfile` が成功すること（lockfile との整合）

## 7. リスク・未決事項

- **ライフサイクルスクリプトの漏れ**: `onlyBuiltDependencies` に追加し忘れたパッケージがある場合、そのパッケージが正しく動作しない可能性がある。CI の build ステップで検出できる見込み。
- **lockfile 差分**: pnpm 10 が依存解決を微妙に変える場合、lockfile に大きな差分が出る可能性がある。ただし `lockfileVersion: '9.0'` は互換のため、形式的な差分は最小のはず。
- **Volta のない環境**: リモートコンテナ等 Volta が未インストールの環境では `volta.pnpm` は無視される。影響なし（`packageManager` フィールドが corepack で機能する）。
