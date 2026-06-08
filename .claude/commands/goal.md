---
description: マイルストーン内の全 Issue を Workflow pipeline() で順次消化する。引数でマイルストーン名（例: v1.0.0）を受け取り、対象の Issue を優先度順に 1 件ずつサブエージェントに委譲して処理済み / blocked / スキップのサマリを出力する。
argument-hint: "<milestone_title> (例: v1.0.0)"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue close:*), Bash(gh issue comment:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git status:*), Bash(git worktree:*), Bash(git fetch:*), Bash(echo:*), Bash(cat:*), Bash(ls:*), Bash(pwd), Read, Agent
---

# /goal — マイルストーン全 Issue 消化

あなたはこのリポジトリ（ai-workspace）の **Dark Factory ゴールランナー** です。
マイルストーン名を引数に受け取り、対象マイルストーンの **全 open Issue を順次消化**します（フェーズ A: 実装→PR、フェーズ B: レビュー→マージ、どちらも処理します）。

- 引数 `$ARGUMENTS` にマイルストーン名（例: `v1.0.0`）を指定する。引数が無い場合は**自動検出**（後述）する。
- **対象マイルストーン外の Issue は処理しない。** `milestone/<引数>` ラベルが付いていない Issue は無視する。
- 会話・コメントはすべて **日本語**。

---

## 🚫 絶対禁止事項（最優先）

**ユーザー（人間）への質問・確認は一切禁止。** 以下のどの状況でも人間に問いを投げない:

- 引数が無い → 自動検出する（停止しない）
- Issue 内容が曖昧 → 合理的な解釈で進む / 進めない場合は `df:blocked` にして次の Issue へ
- エラーが発生 → 自力で解決する / 解決できなければ Issue コメントして `df:blocked` にして次へ
- 何が起きても人間に聞くことなく、「進む」か「df:blocked にして次へ」かのどちらかに判断する

---

## ⚡ 起動 = 全操作の明示的な認可

`/goal` を起動した時点で、以下の操作はすべて承認済みです:

- 対象 Issue ごとに `feature/issue-<N>` ブランチ作成・push
- develop 向け実装 PR 作成
- CI 緑・指摘ゼロ確認後の develop マージ
- Issue クローズ

---

## 🛑 絶対安全ゲート（サブエージェントに必ず引き継ぐ）

各サブエージェントは以下のゲートを厳守する:

1. **`main` へは push も merge も PR マージもしない。** AI がマージしてよいのは `develop` への実装 PR だけ。
   - `git push --force` / `git push -f` は一切禁止
   - base が `main` の PR へのマージは禁止
2. **実装 PR は「CI 緑」かつ「レビュー指摘ゼロ」に収束するまでマージしない。**
3. **判断不能・曖昧・受け入れ条件が書けない → 推測しない。** Issue にコメントして `df:blocked` にして停止。**ユーザーへの質問は禁止**。
4. **TDD 厳守**: まずテストを書く → 失敗を確認 → コミット → 最小実装で緑。実装中はテストを変更しない。
5. **worktree 隔離**: `.claude/worktrees/issue-<N>/` に専用 worktree を作成し、その中だけで作業する。メインツリーは switch しない。
6. **自走優先**: 人間への確認を投げることは禁止。迷った時は Issue コメントして `df:blocked` にして次へ進む。

---

## STEP 0 — マイルストーンの決定と対象 Issue の一覧取得

### マイルストーン名の決定

1. `$ARGUMENTS` が指定されていれば、それをマイルストーン名として使う。
2. **引数が無い場合（自動検出）**: 以下のコマンドでオープンなマイルストーンを取得し、アルファベット昇順で最初のもの（= 最も直近の締切）を選ぶ:
   ```
   gh api repos/{owner}/{repo}/milestones --jq '[.[] | select(.state=="open")] | sort_by(.title) | .[0].title'
   ```
   オープンなマイルストーンが存在しない場合は、Issue の `milestone/*` ラベルから一覧を取り、アルファベット昇順で最小のものを選ぶ:
   ```
   gh issue list --state open --limit 100 --json labels \
     -q '[.[].labels[].name | select(startswith("milestone/"))] | unique | sort | .[0]' \
     | sed 's|milestone/||'
   ```
   それでも取得できない場合は「処理対象の Issue が見つかりませんでした（オープンマイルストーン未設定）」と報告して終了する。停止してユーザーに問い返さない。

### 対象 Issue の取得

3. `gh issue list` で `milestone/<マイルストーン名>` ラベルが付いた open Issue を取得する（`df:todo` ラベルの有無は問わない）:
   ```
   gh issue list --state open --label "milestone/<マイルストーン名>" \
     --limit 100 --json number,title,labels,createdAt \
     -q 'sort_by(.createdAt)[] | "\(.number)\t\(.title)\t[\([.labels[].name] | join(","))]"'
   ```
4. **対象マイルストーン外の Issue は処理しない。** `milestone/<マイルストーン名>` ラベルが付いていない Issue は一覧から除外する。
   各 Issue について `gh pr list --head feature/issue-<N> --state open` でフェーズを判定する:
   - **フェーズ A**（PR なし）: 実装 → 実装 PR 作成 → フェーズ B へ続ける
   - **フェーズ B**（develop ベース open PR あり）: セルフレビュー → develop マージ → Issue クローズ
5. 優先度順にソートする（`priority/critical` > `priority/high` > `priority/medium` = 未設定 > `priority/low`、同優先度は `createdAt` 古い順 FIFO）。

---

## STEP 1 — Workflow pipeline() で順次処理

> **`parallel()` は禁止。** `develop` ブランチへの同時 push が競合するため、必ず `pipeline()` で順次処理する。

Workflow の `pipeline()` を使い、STEP 0 で取得した Issue を 1 件ずつ順番に処理する:

```
pipeline([
  issue_1 → サブエージェント A,
  issue_2 → サブエージェント B,
  ...
])
```

各ステップは **独立したサブエージェント** を起動し、Issue 間でコンテキストが汚染されない。

### サブエージェントへのプロンプト構成

各サブエージェントには以下を含める:

1. **対象 Issue 番号**（`#<N>`）と Issue 本文（`gh issue view <N>` の出力）
2. **「ユーザーへの質問は絶対禁止」の明示**:
   - 不明点・曖昧な要件は合理的な解釈で進む
   - 自力解決できない場合は Issue に `df:blocked` コメントを残して停止し、結果を返す
   - 人間に問いを投げることは禁止
3. **絶対安全ゲート全文**（上記「絶対安全ゲート」セクション）
4. **Dark Factory ワークフロー要点**:
   - feature ブランチ命名: `feature/issue-<N>`
   - worktree パス: `.claude/worktrees/issue-<N>/`
   - PR base: `develop`（main への操作禁止）
   - CI 緑必須・TDD 厳守
   - 実装完了後: セルフレビュー（/code-review 相当）→ develop マージ → Issue クローズ
5. **エラー隔離の指示**: 判断不能な場合は Issue に `df:blocked` コメントを残して停止し、結果を返す。**次の Issue へは進まない（パイプラインが次ステップを担当する）**。

---

## STEP 2 — エラー隔離と状態記録

各サブエージェントの結果を集計する:

| 状態 | 判定条件 |
|------|----------|
| **処理済み** | develop マージ + Issue クローズが完了 |
| **blocked** | `df:blocked` コメントが付き停止 |
| **スキップ** | Issue が closed 済み / 対象マイルストーン外 |

- **`df:blocked` になっても次の Issue に進む（エラー隔離）。** 1 件のブロックは後続の処理を止めない。
- blocked になった Issue は人間の介入を待つ。自動選択で再び選ばれないよう、マイルストーンを解除することを Issue コメントで促す。

---

## STEP 3 — 最終サマリ出力

全 Issue の処理完了後、以下の形式でサマリを出力する:

```
## /goal サマリ: milestone/<マイルストーン名>

| 状態 | 件数 | Issue 番号 |
|------|------|-----------|
| ✅ 処理済み | N 件 | #X, #Y, ... |
| 🚫 blocked  | N 件 | #X, #Y, ... |
| ⏭ スキップ  | N 件 | #X, #Y, ... |

### 次のアクション
- 処理済みの Issue は develop マージ済み。👤 人間が develop → main を昇格すれば本番反映。
- blocked の Issue は人間の介入が必要。Issue コメントを確認してください。
```

---

## クイック判断フロー

```
引数チェック:
  - 引数あり → そのままマイルストーン名として使う
  - 引数なし → gh api でオープンマイルストーンを取得 → アルファベット昇順で最小を自動選択
              → それも無ければ issue の milestone/* ラベルから自動選択
              → それも無ければ「対象なし」と報告して終了（停止・質問しない）
   ↓
gh issue list で milestone/<マイルストーン名> + open を取得（df:todo ラベルは不要、milestone ラベルのみでフィルタ）
   ↓
対象マイルストーン外の Issue を除外（milestone/<マイルストーン名> ラベル未設定は処理しない）
   ↓
優先度順ソート（critical > high > medium = 無印 > low → createdAt 古い順）
   ↓
Workflow pipeline() で順次サブエージェントに委譲
  ※ parallel() 禁止（develop ブランチ競合防止）
  各サブエージェント:
    Issue を /df 相当のロジックで処理（設計書+TDD実装→PR→セルフレビュー→developマージ→クローズ）
    ユーザーへの質問は絶対禁止（不明点は合理的解釈で進む / 無理なら df:blocked にして停止）
    判断不能 → df:blocked コメント残して停止（後続は pipeline が引き継ぐ）
   ↓
全件完了後にサマリ（処理済み / blocked / スキップ件数）を出力
```
