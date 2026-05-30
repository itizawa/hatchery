# 設計書: 自動でリリース用の PR が作成されるようにする (#18)

- 関連 Issue: #18
- 関連ドキュメント: `docs/dark-factory-workflow.md`（ブランチ戦略 / ゲート1: 本番昇格は人間のみ）, `/df` フェーズ B ゲート1
- 関連 ADR: ADR-0002（ツールチェーン: pnpm + Turborepo / Node 26 / `.nvmrc`）
- 参考: `itizawa/wiscro` の `.github/workflows/auto-release-pr.yml`（非公開のため内容は直接参照できず、一般的な「release PR 自動作成」パターンとして設計）

## 1. 目的 / 背景

Dark Factory では `develop → main` の昇格（本番反映）は **人間がマージする**（`docs/dark-factory-workflow.md` ブランチ戦略・`/df` ゲート1）。しかし現状、その「リリース PR（develop → main）」は人間が手作業で都度作成する必要があり、

- どこまでが未リリース（main 未反映）かが一目で分からない
- リリース PR の作成自体が忘れられる／後回しになる

という運用負荷がある。

本 Issue は、**`develop` が更新されるたびに `develop → main` のリリース PR を自動で作成／更新する** GitHub Actions ワークフローを 1 本追加し、人間は「出来上がっているリリース PR をマージするだけ」で本番昇格できる状態にする。

**重要（ゲート1 との整合）**: 本ワークフローが行うのは PR の **作成・更新のみ**。**マージ（本番昇格）は一切行わない**。マージは引き続き人間の専権事項であり、ゲート1（`main` へは AI / 自動化はマージしない）に抵触しない。

## 2. スコープ（やること / やらないこと）

### やること

- `.github/workflows/auto-release-pr.yml` を 1 本追加する。
- トリガー: `develop` への push（統合のたびにリリース PR を最新化）＋ `workflow_dispatch`（手動再生成）。
- `develop` が `main` より進んでいる（未反映コミットがある）場合に、`base: main` / `head: develop` の PR を **無ければ新規作成・あれば本文/タイトルを更新**する（リリース PR は常に 1 本）。
- PR 本文に `main..develop` のコミット一覧（リリース内容）を載せ、レビュー/昇格判断を助ける。
- `develop` が `main` と同一（未反映コミットなし）の場合は何もせずスキップする。

### やらないこと

- **リリース PR のマージ（`develop → main` の本番昇格）**。これは人間ゲート（ゲート1）。本ワークフローは作成・更新まで。
- バージョニング / タグ付け / CHANGELOG ファイル生成 / リリースノート公開（必要になれば別 Issue）。
- 本番デプロイ・デプロイパイプライン。
- branch protection の設定（GitHub 設定。人間が別途実施）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `.github/workflows/auto-release-pr.yml` が存在し、YAML として妥当（パース可能）。
2. `on` に `push`（`branches: [develop]`）トリガーが定義されている（develop 更新で起動）。
3. `on` に `workflow_dispatch`（手動起動）が定義されている。
4. トリガーは `main` への push を対象にしない（ゲート1 整合: main を直接の起点にしない）。
5. `permissions` に `pull-requests: write` が定義されている（PR 作成・更新に必要）。最小権限とし、`contents` は `write` にしない（読み取りのみで足りる）。
6. リリース PR の向きが `base: main` / `head: develop` である（develop → main）ことが、PR 作成コマンド（`gh pr create ... --base main --head develop`）として記述されている。
7. **マージを行わない**: ステップの `run` に `gh pr merge` や PR マージ API 呼び出しが**含まれない**（ゲート1）。
8. 既存のオープンなリリース PR の有無を確認し、あれば更新・なければ作成する分岐（`gh pr list` による既存検出）を持つ。
9. `develop` が `main` より進んでいない場合に作成をスキップする分岐（`git rev-list --count` 等による差分判定）を持つ。
10. `concurrency` が定義され、リリース PR ワークフローが多重実行されない（リリース PR を 1 本に保つ）。
11. `actions/checkout` を `fetch-depth: 0`（全履歴）で実行する（`main..develop` の差分・ログ算出に必要）。

## 4. 設計方針

### 4.1 ファイル構成（本 Issue で追加する範囲）

```
.github/
└── workflows/
    └── auto-release-pr.yml   # develop push で develop → main のリリース PR を作成／更新（マージはしない）
docs/design/issue-18.md       # 本設計書
tests/auto-release-pr-workflow.test.ts  # ワークフロー定義の静的検証（既存 ci-workflow.test.ts と同方式）
```

### 4.2 ワークフロー構造（概念）

```yaml
name: Auto Release PR

on:
  push:
    branches: [develop] # develop が更新されたら起動
  workflow_dispatch: # 手動再生成も可能

concurrency:
  group: auto-release-pr # リリース PR は常に 1 本（多重実行を防ぐ）
  cancel-in-progress: true

permissions:
  contents: read # 履歴の読み取りのみ（最小権限）
  pull-requests: write # PR の作成・更新に必要

jobs:
  release-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # main..develop の差分・ログ算出に全履歴が必要
      - name: Create or update release PR (develop -> main)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # main 未反映の develop コミットが無ければスキップ
          # 既存のオープンなリリース PR があれば更新・無ければ作成（gh pr create --base main --head develop）
          # ※ マージ（gh pr merge）は絶対に行わない＝本番昇格は人間ゲート（ゲート1）
```

### 4.3 主要な判断

- **トリガーは `develop` push のみ**（＋手動）。`main` を起点にしない＝ゲート1 と整合。リリース PR は「develop が main に対して持つ差分」を映す鏡なので、develop が動いたときだけ更新すれば十分。
- **作成と更新を冪等に**: 同じリリース PR を毎回作り直さず、既存のオープン PR があれば本文/タイトルを更新する（`gh pr list` で検出 → `gh pr edit`、無ければ `gh pr create`）。これにより push のたびに PR が乱立しない。
- **マージは絶対にしない**: ワークフローのどのステップでも `gh pr merge` / マージ API を呼ばない。本番昇格は人間がこの PR をマージして行う（ゲート1）。受け入れ条件7 でテストでも担保する。
- **最小権限**: `permissions` を `contents: read` + `pull-requests: write` に絞る。`contents: write` は不要（コミット/push しないため）。
- **差分ゼロ時はスキップ**: `git rev-list --count origin/main..origin/develop` が 0 なら PR 作成不要として終了。空 PR を作らない。
- **`fetch-depth: 0`**: `actions/checkout` は既定で shallow（履歴1件）のため、`main..develop` のコミット一覧・差分件数を計算できるよう全履歴を取得する。

### 4.4 前提・運用上の注意（人間向け・本ワークフロー外）

- **GitHub Actions の PR 作成許可**: 既定の `GITHUB_TOKEN` で PR を作成するには、リポジトリ設定 _Settings → Actions → General → Workflow permissions_ の **「Allow GitHub Actions to create and approve pull requests」を有効化**しておく必要がある（無効だと `gh pr create` が権限エラーになる）。この設定は GitHub の管理画面操作のため本 Issue のスコープ外（設計書に明記して人間に委ねる）。
- 自動作成されたリリース PR（base=main）には、`docs/dark-factory-workflow.md` のとおり **CI（`ci.yml`）はトリガーされない**（CI は base=develop 限定）。リリース PR の品質は develop へマージされた時点で既に担保済みという前提に立つ。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: CI/docs）

- **新規追加のみ**: `.github/workflows/auto-release-pr.yml`、`docs/design/issue-18.md`、`tests/auto-release-pr-workflow.test.ts`。既存のアプリコード・設定・既存ワークフロー（`ci.yml`）は変更しない。
- `ci.yml`（#13）とは独立。`ci.yml` は develop 統合の番人、本ワークフローは develop→main のリリース PR 自動化で、責務が分かれている。

## 6. テスト計画（TDD で書くテスト一覧）

GitHub Actions の YAML 追加が中心のため、既存 `tests/ci-workflow.test.ts` と同方式で **ワークフロー定義の静的検証**（Vitest + `js-yaml` でパースして構造を assert）を `tests/auto-release-pr-workflow.test.ts` に実装する。

1. **YAML 妥当性**: `auto-release-pr.yml` がパース可能（受け入れ条件1）。
2. **トリガー定義**: `on.push.branches` が `develop` を含み `main` を含まない／`on` に `workflow_dispatch` がある（受け入れ条件2・3・4）。
3. **権限**: `permissions.pull-requests === 'write'`、`permissions.contents !== 'write'`（受け入れ条件5）。
4. **PR の向き**: いずれかのステップ `run` に `--base main` と `--head develop`（または `gh pr create` の develop→main 指定）が含まれる（受け入れ条件6）。
5. **マージしない**: どのステップ `run` にも `gh pr merge` / `pr merge` が**含まれない**（受け入れ条件7・ゲート1）。
6. **冪等な作成/更新**: `run` に `gh pr list`（既存検出）と `gh pr create` が含まれる（受け入れ条件8）。
7. **差分ゼロ判定**: `run` に `rev-list` 等の差分件数判定が含まれる（受け入れ条件9）。
8. **concurrency**: トップレベル `concurrency.group` が定義されている（受け入れ条件10）。
9. **checkout 全履歴**: `actions/checkout` ステップが `with.fetch-depth: 0`（受け入れ条件11）。

> テストは「必須要素の存在」を確認する粒度に留め、過度な完全一致 assert を避ける（既存 `ci-workflow.test.ts` の方針に倣う）。検証は `pnpm test:repo`（`vitest run --root . --dir tests`）で実行する。

## 7. リスク・未決事項

- **`GITHUB_TOKEN` の PR 作成許可**: 上記 4.4 の設定が無効だとワークフローは失敗する。設計書で人間に明示。将来 PAT / GitHub App トークンに切り替える選択肢もあるが、初版は最小構成（既定トークン + リポジトリ設定）とする。
- **本ワークフローの dogfooding 不可**: base=main の PR 作成を伴うため、実装 PR（base=develop）のマージ前に実挙動を完全には検証できない。develop へマージ後、次の develop push で初めて実走する。実装 PR では静的検証（テスト）で受け入れ条件を担保し、実走確認は develop 反映後とする。
- **PR 本文のコミット一覧肥大**: main から大きく離れると本文が長くなる。初版はそのまま全件記載（昇格頻度を上げれば自然に短くなる）。問題化したら件数上限や折りたたみを別 Issue で検討。
- **`auto-release-pr.yml` は `tests/` 配下テストで検証するが、`turbo run test`（CI）には含まれない**: 既存 `ci-workflow.test.ts` も同様で、リポジトリ全体テストは `pnpm test:repo` で回す運用。これは本 Issue で変えない（CI への `test:repo` 組み込みは別途）。
