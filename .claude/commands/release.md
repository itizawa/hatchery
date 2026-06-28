---
description: リリースノート自動生成 routine。main に未タグの新規マージがあるか検知し、タグ作成・GitHub Release 作成・リリースノート生成を冪等に実行する。develop→main 昇格後に /schedule で定期実行する。
argument-hint: ""
allowed-tools: Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh release view:*), Bash(gh release create:*), Bash(gh release edit:*), Bash(git fetch:*), Bash(git tag:*), Bash(git log:*), Bash(git push:*), Bash(git ls-remote:*), Bash(git rev-parse:*), Bash(git describe:*), Bash(echo:*), Bash(grep:*), Bash(head:*)
---

# /release — リリースタグ・GitHub Release・リリースノート自動生成

このコマンドは `develop → main` 昇格後に定期実行（routine / cron）されることを前提とし、**冪等に**タグ作成・GitHub Release・リリースノートを生成する。

---

## 実行手順

### STEP 1 — 最新マージ PR を取得してバージョンを確定する

```bash
gh pr list --base main --state merged --limit 1 \
  --json number,title,mergeCommit \
  -q '"\(.number)\t\(.title)\t\(.mergeCommit.oid)"'
```

取得した PR タイトルから `vX.Y.Z` 形式のバージョンを抽出する。抽出できない場合は「バージョンを抽出できなかったためスキップします」と報告して終了。

### STEP 2 — 冪等スキップ判定

以下を**両方**確認し、いずれかに該当する場合は「既に処理済みのためスキップします（冪等）」と報告して終了:

1. **リモートに同名タグが存在するか**:
   ```bash
   git fetch --tags
   git ls-remote --tags origin "refs/tags/<version>"
   ```
   出力が空でない → スキップ。

2. **GitHub Release が既に存在するか**:
   ```bash
   gh release view <version> 2>&1
   ```
   エラーなし（Release 存在）→ スキップ。

### STEP 3 — 前回タグからのコミット一覧を収集する

```bash
# 前回タグを取得
git describe --tags --abbrev=0 <mergeCommitOid>^ 2>/dev/null || echo ""
```

前回タグがある場合: `git log --no-merges --pretty=format:'- %s (%h)' <prev_tag>..<mergeCommitOid>`

前回タグが無い場合: `git log --no-merges --pretty=format:'- %s (%h)' <mergeCommitOid>^1..<mergeCommitOid>`

### STEP 4 — タグを作成してプッシュする

```bash
git tag <version> <mergeCommitOid>
git push origin <version>
```

push に失敗した場合（並行実行による競合等）はエラーを記録して STEP 5 へ進む（Release 作成は試みる）。

### STEP 5 — GitHub Release を作成する

コミット一覧をフォールバックノートとして Release を作成する:

```bash
gh release create <version> \
  --title "Release <version>" \
  --notes "## リリースノート

<コミット一覧（STEP 3 で収集したもの）>"
```

Release 作成に失敗した場合は「Release 作成に失敗しました」と報告して終了。タグのみ作成済みの状態になる（次回実行時にスキップされるため重複しない）。

### STEP 6 — リリースノートを生成して Release 本文を更新する

このステップに失敗しても STEP 5 で作成した Release（コミット一覧ノート）を壊さない。

以下のフォーマット（#602 統一フォーマット）でリリースノートを生成する:

```markdown
## 概要
<バージョン <version> の全体概要を 1〜2 文で記述する>

### ✨ 新機能
- <feat: で始まるコミットをユーザー視点で要約>

### 🛠 改善
- <パフォーマンス・UX 改善を要約>

### 🐛 修正
- <fix: で始まるコミットを要約>

### 🔧 その他
- <refactor: / config: / test: / docs: / style: 等を要約>
```

ガイドライン:
- 概要は 1〜2 文（最大 500 文字）でリリース全体を総括する
- 各カテゴリは該当コミットが無い場合は見出しごと省略する
- 各項目はユーザー視点でわかりやすく要約する（最大 200 文字）
- 「STEP 3 で収集したコミット一覧」を入力として使う

生成したリリースノートで Release 本文を更新する:

```bash
gh release edit <version> --notes "<生成したリリースノート>"
```

### STEP 7 — 完了を報告する

以下を報告して終了:
- 処理したバージョン
- タグの作成 / スキップ状態
- Release URL
- リリースノートの生成成功 / フォールバック状態

---

## 冪等性の保証

- **同名タグが存在する** → STEP 2 でスキップ（何も作成しない）
- **同名 Release が存在する** → STEP 2 でスキップ（何も作成しない）
- **タグ push は成功したが Release 作成が失敗した** → 次回実行時に STEP 2 でタグ存在を検知してスキップされるため、Release が二重に作成されることはない
- **PR タイトルに `vX.Y.Z` が無い** → STEP 1 でスキップ

---

## エラーハンドリング方針

| 失敗箇所 | 影響 | 対応 |
|----------|------|------|
| バージョン抽出失敗 | リリース無し | スキップして終了 |
| タグ push 失敗 | タグ無し・Release 無し | エラー報告して終了 |
| Release 作成失敗 | タグのみ作成済み | エラー報告して終了（次回 cron は STEP 2 のタグ確認でスキップ） |
| ノート生成失敗 | フォールバックノート（コミット一覧）を保持 | エラーを記録し Release 本文はそのまま |
