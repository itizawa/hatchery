# 設計書: CI ワークフロー（GitHub Actions で turbo run lint/test/build を develop PR に強制） (#13)

- 関連 Issue: #13
- 関連 ADR: ADR-0002（ツールチェーン: pnpm + Turborepo / Node 26）
- 関連ドキュメント: `docs/dark-factory-workflow.md` §5「方式 A（CI 連携）」, `/df` フェーズ C ゲート 3・5
- 依存 Issue: #4（monorepo 基盤・`turbo run lint test build`）が `develop` にマージ済みであること
- ステータス: 設計レビュー待ち

## 1. 目的 / 背景

Dark Factory のフェーズ C（実装 PR のレビュー → develop マージ）では、AI は **「CI 緑（test/lint）かつ指摘ゼロ」** を満たしたときのみ `develop` へマージできる（`docs/dark-factory-workflow.md` §5 / `/df` フェーズ C ゲート 3・5）。

しかし現状リポジトリには `.github/workflows/` が存在せず、PR に付くチェックは外部スキャン（GitGuardian 等）のみで **`test` / `lint` / `build` を走らせる CI が無い**。このため `/df` フェーズ C のマージ前ゲート (c)「外部チェックの pass だけでは CI 緑とみなさない」に該当し、AI は毎回ローカル実行へフォールバックするか `df:blocked` で停止せざるを得ない（#4 実装時に顕在化）。

本設計は、`develop` 向け PR と `develop` への push に対し `turbo run lint test build` を実行する **GitHub Actions ワークフロー**を 1 本追加し、フェーズ C を AI が自走で完走できる状態にする。位置づけは `docs/dark-factory-workflow.md` §5「方式 A（CI 連携）」の **CI 実体**（test/lint/build を回す番人）であり、Claude Code Action による自動トリガー（`df-develop.yml` 等のエージェント起動）は本 Issue のスコープ外。

## 2. スコープ（やること / やらないこと）

### やること

- `.github/workflows/ci.yml` を 1 本追加する。
- トリガー: `develop` 向け PR（`pull_request`、base = `develop`）と `develop` への push（`push`）。
- ジョブ: チェックアウト → pnpm セットアップ → Node セットアップ（`.nvmrc` 準拠 = Node 26）→ `pnpm install --frozen-lockfile` → `turbo run lint test build`。
- pnpm / Node の依存キャッシュ、可能なら Turborepo のキャッシュで実行時間を抑える。
- 本ワークフローが緑になることを、本 Issue の実装 PR 自身で実証する（dogfooding）。
- `/df` フェーズ C ゲート (c) が満たせるよう、`gh pr checks` に **プロジェクト由来の test/lint を走らせるチェック**が `success`/`failure` として現れる名前付きジョブにする。

### やらないこと

- 本番デプロイ・`develop → main` 昇格の自動化（昇格は人間ゲート、ゲート 1）。
- GitHub Pages（Storybook）デプロイ（#9）。
- カバレッジ計測・通知連携（Slack 等）・マトリクスビルド（必要なら別 Issue）。
- branch protection の設定そのもの（GitHub 設定。CI 必須化は本ワークフロー追加後に人間が別途実施）。
- Claude Code Action のエージェント起動ワークフロー（`df-develop.yml` 等、方式 A のエージェント側）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `.github/workflows/ci.yml` が存在し、YAML として妥当（パース可能）。
2. `on` に `pull_request`（`branches: [develop]`）と `push`（`branches: [develop]`）の両トリガーが定義されている。
3. ジョブ内で `pnpm/action-setup` により pnpm がセットアップされ、`packageManager` フィールド（ルート `package.json`）と整合する。
4. `actions/setup-node` の `node-version-file: .nvmrc` で Node 26 をセットアップする（バージョンをハードコードせず `.nvmrc` を参照する）。
5. `pnpm install --frozen-lockfile` を実行し、lockfile 不整合時にジョブが失敗する。
6. `turbo run lint test build` を実行し、`lint`・`test`・`build` のいずれかが失敗するとジョブが赤になる（= 終了コード非 0 でジョブ失敗）。
7. ワークフローのジョブ名（例: `ci` / `build-test-lint`）が、外部スキャン（GitGuardian 等）とは区別できる **プロジェクト由来のチェック名**として `gh pr checks <PR> --json name,state` に現れる。
8. 依存・ビルドのキャッシュ（`actions/setup-node` の `cache: pnpm`、または `actions/cache`）が設定されている。
9. 本 Issue の実装 PR（base = `develop`）で本ワークフローがトリガーされ、`success` になる（dogfooding）。
10. ワークフローは `develop` 以外を base とする PR（特に `main`）では本 CI を要求しない（トリガー定義が `develop` に限定されている。ゲート 1 と矛盾しない）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4.1 ファイル構成（本 Issue で追加する範囲）

```
.github/
└── workflows/
    └── ci.yml        # develop 向け PR / push で turbo run lint test build を実行
```

`docs/dark-factory-workflow.md` §5 のディレクトリ図にある `df-develop.yml` 等（Claude Code Action のエージェント起動）は本 Issue では作らない。本 Issue が用意するのは「番人としての CI」だけ。

### 4.2 ワークフロー構造（`ci.yml` の概念）

```yaml
name: CI

on:
  pull_request:
    branches: [develop]
  push:
    branches: [develop]

# 同一ブランチ/PR の古い実行はキャンセルして実行時間を節約
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4          # packageManager フィールドからバージョン解決
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc          # Node 26（ハードコードしない）
          cache: pnpm                        # pnpm ストアの依存キャッシュ
      - run: pnpm install --frozen-lockfile  # lockfile 整合を保証
      - run: pnpm turbo run lint test build   # いずれか失敗でジョブ赤
```

- **トリガーを `develop` に限定**: `pull_request.branches: [develop]` と `push.branches: [develop]` で、`develop` への統合フローだけを CI 対象にする。`main` 昇格 PR は人間ゲートであり本 CI の対象にしない（ゲート 1 と整合）。
- **Node はファイル参照**: `node-version-file: .nvmrc` で ADR-0002 の Node 26 を単一情報源（`.nvmrc`）から取得する。バージョンを 2 箇所に書かない。
- **pnpm バージョンは `packageManager` 準拠**: `pnpm/action-setup@v4` は `package.json` の `packageManager` フィールドから pnpm バージョンを解決する（#4 で固定される）。CI 側で別途バージョンを指定しないことで二重管理を避ける。
- **`--frozen-lockfile`**: lockfile が古い／不整合のときに CI を失敗させ、ローカルと CI の依存差異を防ぐ。
- **`turbo run lint test build`**: ADR-0002 のタスク定義（#4 で `turbo.json` に整備）をそのまま 1 行で回す。Turborepo が依存順（common → client/server）と並列を解決する。
- **`concurrency` でキャンセル**: 同一 PR の連続 push で古いジョブを止め、CI 時間と Actions 分を節約する。

### 4.3 キャッシュ方針

- **依存キャッシュ**: `actions/setup-node` の `cache: pnpm` で pnpm ストアをキャッシュ（lockfile ハッシュをキーに自動管理）。受け入れ条件 8 を満たす最小実装。
- **Turborepo キャッシュ（任意）**: ローカル `.turbo` を `actions/cache` でキャッシュすればさらに短縮できるが、必須ではない。リモートキャッシュ（Vercel Remote Cache 等）は本 Issue では導入しない（Secret 管理が増えるため別途検討）。初版は依存キャッシュのみで開始し、実行時間が問題化したら Turbo キャッシュを追加する。

### 4.4 ジョブ名とフェーズ C ゲートとの整合

`/df` フェーズ C ゲート (c) は「test/lint を走らせる**プロジェクト由来のチェック**が存在し、それが緑であること」を要求する。そのため:

- ジョブ名を `build-test-lint`（または `ci`）のように明示し、`gh pr checks <PR> --json name,state` で外部スキャン（`GitGuardian Security Checks` 等）と判別できるようにする。
- このチェックが `success` であれば、フェーズ C はローカル再実行へフォールバックせず CI 緑と判定できる。これが本 Issue の主目的。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / **docs/CI**）

- **新規追加のみ**: `.github/workflows/ci.yml` 1 ファイル。既存のアプリコード・設定・ドキュメントは変更しない。
- **前提**: 本ワークフローは `.nvmrc` / `package.json`（`packageManager`）/ `pnpm-lock.yaml` / `turbo.json` と、`lint` / `test` / `build` タスクが `develop` に存在することを前提とする。これらは **#4（monorepo 基盤）** が `develop` にマージされて初めて揃う。実装フェーズ着手時に #4 が未マージなら、本 Issue は #4 マージ後まで実装を保留する（設計はこの依存を明記して先行可能）。
- **運用改善（人間タスク・スコープ外）**: 本 CI 追加後、`develop` / `main` に branch protection（本 CI を required check に・`main` 直 push 禁止）を設定できるようになる。これにより `/df` の「ゲート 1・3 は本コマンドの遵守のみが砦」という現状（branch protection 未設定）が、GitHub 側の機械的番人で補強される。

## 6. テスト計画（TDD で書くテスト一覧）

本 Issue は GitHub Actions の YAML 追加が中心で、ユニットテストの対象は乏しい。検証は「ワークフロー定義の静的検証」＋「実 PR での dogfooding」で担保する。

1. **YAML 妥当性テスト**: `ci.yml` を YAML パーサで読み込めること（構文エラーが無いこと）を検証する小スクリプト／テスト（受け入れ条件 1）。
2. **トリガー定義テスト**: パースした YAML の `on.pull_request.branches` と `on.push.branches` がともに `develop` を含むことを assert（受け入れ条件 2・10）。
3. **ステップ定義テスト**: ジョブのステップ列に (a) `pnpm/action-setup`、(b) `actions/setup-node` で `node-version-file: .nvmrc`、(c) `pnpm install --frozen-lockfile`、(d) `turbo run lint test build` を含む `run`、が順序込みで存在することを assert（受け入れ条件 3・4・5・6）。
4. **キャッシュ設定テスト**: `setup-node` の `cache: pnpm`（または `actions/cache` ステップ）が存在することを assert（受け入れ条件 8）。
5. **dogfooding（手動/実 PR 検証）**: 本 Issue の実装 PR（base = `develop`）で本ワークフローがトリガーされ `success` になることを、`gh pr checks` の出力で確認する（受け入れ条件 7・9）。これは自動テストではなく実行結果として PR 本文のサマリに記載する。

> 上記 1〜4 はリポジトリ内で実行可能な静的検証（例: Vitest + `js-yaml` で `ci.yml` をパースして構造を assert、あるいは `actionlint` 等の linter を CI 内に追加）として実装する。5 は実 PR の CI 実行で確認する。受け入れ条件の各項目と本テスト計画を対応付け、実装 PR のサマリに `turbo run lint test build` と本 CI が緑であることを記載する。

## 7. リスク・未決事項

- **#4 への強い依存**: 本ワークフローは #4 の成果物（`.nvmrc` / `packageManager` / lockfile / `turbo.json` / 各タスク）に全面的に依存する。実装フェーズ着手時に #4 が `develop` 未マージなら、`/df` フェーズ B はゲート 4 に従い保留／`df:blocked`（前提未充足）とし、#4 マージ後に再開する。
- **Actions / 各アクションのバージョン**: 本設計ではメジャーバージョン（`checkout@v4` 等）を方針として示すのみ。具体ピンは実装 PR 時点の安定最新に合わせる。pnpm バージョンは `packageManager` 単一情報源に委ねる。
- **YAML 構造テストの脆さ**: ステップ構造を厳密に assert しすぎると、無害なリファクタ（ステップ追加・順序変更）で落ちる恐れがある。テストは「必須要素の存在」を確認する粒度に留め、過度な完全一致 assert を避ける。
- **Turborepo リモートキャッシュ**: 初版は導入しない（Secret 管理コスト）。CI 時間が問題化したら別 Issue でローカル `.turbo` キャッシュ → リモートキャッシュの順に検討する。
- **`actionlint` 導入の是非**: ワークフローの静的検証に `actionlint` を CI ステップとして足すか、リポジトリ内テストで `js-yaml` パースに留めるかは実装時に確定する（どちらでも受け入れ条件は満たせる）。
