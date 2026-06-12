# 設計書: main マージ時にリリースタグと GitHub Release を自動作成する (#416)

## 1. 目的 / 背景

現状、develop → main のリリース PR は `.github/workflows/auto-release-pr.yml` が自動で作成・更新するが、**リリースタグと GitHub Release は人間が手動で作成**している（`v1.0.0` は手動作成済み）。マイルストーンは `v1.2.0` / `v1.3.0` とバージョン名で運用されており、**マイルストーン名をバージョンの単一情報源**として、リリース PR の main マージ時にタグ + GitHub Release を自動作成する。

## 2. スコープ（やること / やらないこと）

### やること

- `auto-release-pr.yml` のリリース PR タイトルに直近 open マイルストーン名（`vX.Y.Z`）を含める
- `release-tag.yml` ワークフローを新設し、develop→main PR マージ時にタグ + GitHub Release を自動作成する
- `docs/dark-factory-workflow.md` のリリースゲート記述を更新する

### やらないこと

- CHANGELOG.md の生成
- `package.json` version bump
- release-please / changesets 等の外部ツール導入
- タグ push をトリガーにしたデプロイ連動

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `auto-release-pr.yml` が open マイルストーンを API から取得し、PR タイトルを `Release v1.2.0: develop -> main (YYYY-MM-DD)` 形式にする。open マイルストーンが無い場合は従来形式にフォールバックし失敗しない。
2. `release-tag.yml` のトリガーが `pull_request: types: [closed]` / `branches: [main]` であり、`merged == true && head.ref == 'develop'` の条件でのみ実行される。
3. `release-tag.yml` の `permissions` が `contents: write` のみ（`pull-requests: write` なし）。
4. `release-tag.yml` が PR タイトルから `vX.Y.Z` を抽出し、git タグを push + GitHub Release を作成する。
5. バージョン抽出失敗時・同名タグ存在時はスキップして正常終了（冪等）。
6. どのワークフローも `gh pr create` / `gh pr merge` を呼ばない（ゲート1遵守）。

## 4. 設計方針

### auto-release-pr.yml のタイトル拡張

- `gh api "repos/$GITHUB_REPOSITORY/milestones?state=open&sort=due_on&direction=asc&per_page=1"` で open マイルストーストを due_on 昇順で最初の 1 件のみ取得。
- `milestone_name` が空でなければ `Release ${milestone_name}: develop -> main (DATE)` 形式を使用。
- `set -euo pipefail` の下で API 呼び出しが失敗しても `|| true` でフォールバック（ジョブを失敗させない）。

### release-tag.yml の設計

- トリガー: `pull_request` (closed, base=main)
- ジョブ条件: `if: github.event.pull_request.merged == true && github.event.pull_request.head.ref == 'develop'`
- PR タイトルは env 変数 `PR_TITLE` で渡す（コマンドインジェクション防止）
- バージョン抽出: `grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+'`
- タグ存在確認: `git tag | grep -q "^${version}$"` でスキップ判定（冪等）
- リリースノート: 前タグ〜マージコミットの `git log`。前タグなしの場合は全コミット
- `git tag` → `git push origin` → `gh release create` の順で実行

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|---------|----------|
| `.github/workflows/auto-release-pr.yml` | 更新: マイルストーン取得 + タイトル形式変更 |
| `.github/workflows/release-tag.yml` | 新規追加 |
| `docs/dark-factory-workflow.md` | 更新: フェーズ4にタグ自動作成を追記 |
| `tests/auto-release-pr-workflow.test.ts` | 更新: マイルストーンタイトルのテストを追加 |
| `tests/release-tag-workflow.test.ts` | 新規追加 |

## 6. テスト計画（TDDで書くテスト一覧）

### `tests/release-tag-workflow.test.ts`（新規）

1. YAML パース可能
2. `pull_request` closed / base: main トリガー
3. `merged == true && head == develop` 条件をジョブに持つ
4. `contents: write` のみ（`pull-requests: write` なし）
5. `vX.Y.Z` 形式の抽出ロジック（grep -oE）
6. `git tag` + `git push origin` でタグ作成
7. `gh release create` でリリース作成
8. `git log` でリリースノート生成
9. バージョン抽出失敗時に `exit 0` でスキップ
10. タグ重複時に `exit 0` でスキップ（2 箇所以上の `exit 0`）
11. `gh pr create` を呼ばない
12. `gh pr merge` を呼ばない
13. `push` トリガーを持たない（`pull_request` のみ）

### `tests/auto-release-pr-workflow.test.ts`（既存に追加）

14. `gh api` + `milestones` でマイルストーンを取得する
15. `milestone_name` 変数をタイトルに組み込む
16. `if [ -n ...` フォールバック分岐を持つ

## 7. リスク・未決事項

- `auto-release-pr.yml` の `permissions: contents: read` は維持（milestones API 読み取りには read で十分）。
- `release-tag.yml` の `git push origin <tag>` はブランチ保護の対象外のため問題なし。
- マイルストーン名が `vX.Y.Z` 形式でない場合の release-tag.yml でのスキップ動作を想定（抽出失敗 → `exit 0`）。
