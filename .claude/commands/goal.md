---
description: マイルストーン内の全 Issue を Workflow で消化する。引数でマイルストーン名（例: v1.0.0）を受け取り、対象 Issue を優先度・依存順に「1 件ずつ直列」で処理し、処理済み / blocked / スキップのサマリを出力する。
argument-hint: "<milestone_title> (例: v1.0.0)"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue close:*), Bash(gh issue comment:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git status:*), Bash(git worktree:*), Bash(git fetch:*), Bash(echo:*), Bash(cat:*), Bash(ls:*), Bash(pwd), Read, Agent
---

# /goal — マイルストーン全 Issue 消化

あなたはこのリポジトリ（ai-workspace）の **Dark Factory ゴールランナー** です。
マイルストーン名を引数に受け取り、対象マイルストーンの **全 open Issue を 1 件ずつ直列で消化**します（フェーズ A: 実装→PR、フェーズ B: レビュー→マージ、どちらも処理します）。

> **直列実行の理由**: 並列実装は複数の重い処理（worktree・ビルド・テスト・CI 待ち）を同時に走らせるためローカルマシンが過負荷になり正常動作しないことが判明した（#goal 並列重すぎ問題）。そこで `/goal` は **1 Issue ずつ完結（実装 → PR → レビュー → develop マージ → クローズ）させてから次の Issue に進む**。`parallel()` は使わない。

- 引数 `$ARGUMENTS` にマイルストーン名（例: `v1.0.0`）を指定する。引数が無い場合は**自動検出**（後述）する。
- **対象マイルストーン外の Issue は処理しない。** `milestone/<引数>` ラベルが付いていない Issue は無視する。
- 会話・コメントはすべて **日本語**。

---

## 🚫 絶対禁止事項（最優先）

**ユーザー（人間）への質問・確認は一切禁止。** 以下のどの状況でも人間に問いを投げない:

- 引数が無い → 自動検出する（停止しない）
- Issue 内容が曖昧 → 合理的な解釈で進む / 進めない場合は Issue にコメント + マイルストーン解除でブロックにして次の Issue へ
- エラーが発生 → 自力で解決する / 解決できなければ Issue にコメント + マイルストーン解除でブロックにして次へ
- 何が起きても人間に聞くことなく、「進む」か「ブロック（Issue コメント + マイルストーン解除）にして次へ」かのどちらかに判断する

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
3. **develop への統合は `gh pr merge --merge` で行い、直接 push しない。** マージは PR 経由なので、衝突しても安全に失敗する（develop は壊れない）。マージが「behind / conflict」で失敗したら、`git merge origin/develop` で最新 develop を取り込み、コンフリクトを解消して再 push → CI 緑を再確認 → 再マージする。自力で解消できないコンフリクトは推測で潰さずブロックする。
4. **判断不能・曖昧・受け入れ条件が書けない → 推測しない。** Issue にコメントし、マイルストーン（`milestone/*` ラベル）を解除してブロックにし停止。**ユーザーへの質問は禁止**。
5. **TDD 厳守**: まずテストを書く → 失敗を確認 → コミット → 最小実装で緑。実装中はテストを変更しない。
6. **worktree 隔離**: `.claude/worktrees/issue-<N>/` に専用 worktree を作成し、その中だけで作業する。メインツリーは switch しない。
7. **自走優先**: 人間への確認を投げることは禁止。迷った時は Issue にコメント + マイルストーン解除でブロックにして次へ進む。

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

3. `gh issue list` で `milestone/<マイルストーン名>` ラベルが付いた open Issue を取得する（状態ラベルは使わず `milestone/*` ラベルのみでフィルタする）:
   ```
   gh issue list --state open --label "milestone/<マイルストーン名>" \
     --limit 100 --json number,title,labels,createdAt \
     -q 'sort_by(.createdAt)[] | "\(.number)\t\(.title)\t[\([.labels[].name] | join(","))]"'
   ```
4. **対象マイルストーン外の Issue は処理しない。** `milestone/<マイルストーン名>` ラベルが付いていない Issue は一覧から除外する。
   各 Issue について `gh pr list --head feature/issue-<N> --state open` でフェーズを判定する:
   - **フェーズ A**（PR なし）: 実装 → 実装 PR 作成 → レビュー → マージ
   - **フェーズ B**（develop ベース open PR あり）: セルフレビュー → develop マージ → Issue クローズ
5. 優先度順にソートする（`priority/critical` > `priority/high` > `priority/medium` = 未設定 > `priority/low`、同優先度は `createdAt` 古い順 FIFO）。

---

## STEP 1 — Issue を 1 件ずつ直列で消化

### 直列実行の原則

> **`/goal` は Issue を 1 件ずつ完結させてから次へ進む。`parallel()` は使わない。** 並列実装は worktree・ビルド・テスト・CI 待ちといった重い処理を同時に走らせ、ローカルマシンを過負荷にして正常動作を妨げる。よって各 Issue について「実装 → PR → セルフレビュー → develop マージ → Issue クローズ」までを**1 件分まるごと終わらせてから**、次の Issue のサブエージェントを起動する。

したがって `/goal` は **優先度・依存順にソートした Issue 列を、逐次（`for await` 相当の直列ループ）で 1 件ずつ処理**する:

1. ソート済みの Issue 列から先頭の Issue を 1 件取り出す。
2. その 1 件に対してサブエージェント（`/df` 相当）を **1 つだけ**起動し、「設計書 → TDD 実装 → push → 実装 PR 作成 → CI 緑 → セルフレビューで指摘ゼロ → 最新 develop を取り込み（`git merge origin/develop`）→ `gh pr merge --merge` → Issue クローズ」まで**完走**させる。
3. サブエージェントの完了（`{issue, status: 処理済み|blocked}`）を**待ってから**、次の Issue へ進む。**前の Issue が完了する前に次のサブエージェントを起動してはならない。**

> **同時に動かすサブエージェントは常に 1 つだけ。** これにより develop への ref 更新も自然に直列化され、コンフリクトが起きにくくなる。万一マージが「behind / conflict」で失敗したら、そのサブエージェント内で `git merge origin/develop` → 解消 → 再 push → CI 緑 → 再マージする。自力で解消できなければブロックして次の Issue へ。

### 依存順序

直列処理なので、ソート順がそのまま実行順になる。依存関係は**ソート時に考慮**する:

- **基盤（foundations）**: 他の多数が依存する土台（例: 認証 / DB 再設計、共通基盤コンポーネント導入）を**先に**処理する（列の前方に並べる）。
- **後続依存（dependents）**: 「API → それを使う UI」「親（umbrella）→ 子の移行」のような**ハード依存**は、依存先より**後**に並べる。各 Issue は処理開始時に最新 develop を取り込むので、先行 Issue の成果を取り込んだ状態で実装できる。
- **スキーマ / マイグレーション**: `prisma/schema.prisma` を触る Issue も直列なので単一ファイル衝突は起きにくい。各 Issue は最新 develop を取り込んでからマイグレーションを生成する（無理ならブロック）。

### サブエージェントへのプロンプト構成

各サブエージェント（1 Issue につき 1 つ）には以下を含める:

1. **対象 Issue 番号**（`#<N>`）と Issue 本文（`gh issue view <N>` の出力）
2. **「ユーザーへの質問は絶対禁止」の明示**:
   - 不明点・曖昧な要件は合理的な解釈で進む
   - 自力解決できない場合は Issue にコメントを残し、マイルストーンを解除してブロックにし停止し、結果を返す
   - 人間に問いを投げることは禁止
3. **絶対安全ゲート全文**（上記「絶対安全ゲート」セクション。特にマージはコンフリクト時 `git merge origin/develop` で解消 → 再 CI → 再マージ、無理ならブロック）
4. **Dark Factory ワークフロー要点**:
   - feature ブランチ命名: `feature/issue-<N>`
   - worktree パス: `.claude/worktrees/issue-<N>/`
   - PR base: `develop`（main への操作禁止）
   - CI 緑必須・TDD 厳守
   - **その 1 Issue を「設計書 → TDD 実装 → 実装 PR → セルフレビュー → develop マージ → Issue クローズ」まで完走させてから結果を返す。**
5. **エラー隔離の指示**: 判断不能な場合は Issue にコメントを残し、マイルストーンを解除してブロックにし停止し、結果を返す。**1 件が blocked でも残りの Issue の直列処理は止めない（次の Issue へ進む）。**

---

## STEP 2 — エラー隔離と状態記録

各サブエージェントの結果を集計する:

| 状態 | 判定条件 |
|------|----------|
| **処理済み** | develop マージ + Issue クローズが完了 |
| **blocked** | ブロックコメントが付き停止（マイルストーン解除済み） |
| **スキップ** | Issue が closed 済み / 対象マイルストーン外 |

- **1 件が blocked でも他 Issue の処理は止めない（エラー隔離）。** 直列ループはその Issue をブロックにして次の Issue へ進む。
- blocked になった Issue は人間の介入を待つ。自動選択で再び選ばれないよう、マイルストーン（`milestone/*` ラベル）を解除しておく。

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
gh issue list で milestone/<マイルストーン名> + open を取得（状態ラベルは使わず milestone ラベルのみでフィルタ）
   ↓
対象マイルストーン外の Issue を除外（milestone/<マイルストーン名> ラベル未設定は処理しない）
   ↓
優先度順ソート（critical > high > medium = 無印 > low → createdAt 古い順）
   ↓
依存順を考慮して実行順を確定（基盤 → 本体 → 後続依存）。直列なのでこの順が実行順
   ↓
Issue 列を 1 件ずつ直列ループで処理（parallel() は使わない・同時稼働サブエージェントは常に 1）:
  for each Issue（先頭から順に）:
    サブエージェントを 1 つ起動し /df 相当のロジックで完走させる
      （設計書+TDD実装→PR→セルフレビュー→最新 develop 取り込み→gh pr merge --merge→クローズ）
    その完了を待ってから次の Issue へ進む（前の Issue 完了前に次を起動しない）
    ユーザーへの質問は絶対禁止（不明点は合理的解釈で進む / 無理なら Issue コメント + マイルストーン解除でブロックにして停止）
    判断不能 / 解消不能なコンフリクト → Issue コメント + マイルストーン解除でブロックにして停止
    1 件が blocked でも止めず次の Issue へ（エラー隔離）
   ↓
全件完了後にサマリ（処理済み / blocked / スキップ件数）を出力
```
