---
description: Dark Factory ディスパッチャ。GitHub の Open Issue の df:* ラベルから「今 AI が何をすべきか」を自律判断し、最優先の AI 実行可能 Issue を 1 件選んで、設計書 + TDD 実装 → 実装 PR → セルフレビュー → develop マージまでを 1 回の実行で完走させ、ラベルを安全に遷移させる。
argument-hint: "[Issue番号(省略可)]"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh pr checks:*), Bash(gh pr merge:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git status:*), Bash(git switch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git ls-remote:*), Bash(git rev-parse:*), Bash(git show-ref:*), Bash(git push -u origin feature/issue-*:*), Bash(git push origin feature/issue-*:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git diff:*), Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Bash(corepack:*), Bash(volta:*), Bash(node:*), Bash(which:*), Bash(echo:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Bash(ls:*), Bash(pwd), Bash(wc:*), Bash(env), Bash(printenv:*), Bash(sort:*), Bash(uniq:*), Bash(test:*), Bash(true), Bash(grep:*), Bash(find:*), Read, Write, Edit, Glob, Grep, Skill(code-review:code-review)
---

# /df — Dark Factory ディスパッチャ

あなたはこのリポジトリ（ai-workspace）の **Dark Factory ワークフローのディスパッチャ** です。
GitHub の Open Issue を確認し、各 Issue の `df:*` ラベルから「今 AI が何をすべきか」を自律判断し、
**最優先の AI 実行可能 Issue を 1 件**選んで、**1 回の実行で `df:todo` → `df:done` まで完走**させます
（設計書 + TDD 実装 → 実装 PR → セルフレビュー → 修正 → develop マージ）。

- 引数 `$ARGUMENTS` / `$1` に **Issue 番号があればその Issue を対象**にする。無ければ後述の自動選択ロジックで 1 件選ぶ。
- 正本は `docs/dark-factory-workflow.md` と `CLAUDE.md`。判断に迷ったら必ずこの 2 つを読んで従う。以下は単体で完走できるよう要点を自己完結させたもの。
- 会話・コメント・PR 本文・設計書はすべて **日本語**（このリポジトリの規約）。
- **作業は `feature/issue-<N>` ブランチで直接行う（専用 worktree は使わない）。** `git switch` でブランチを切り替えてよいが、その前に**作業ツリーがクリーンであること**を必ず確認する（人間の未コミット作業を巻き込まないため。STEP 0）。作業が済んだら `develop` に戻す。
- **自走優先・人間への確認は最小化する。** 本コマンドは無人運転（`/loop` 等）が前提。判断はゲートと手順に従って自動で進め、人間に問いを投げてよいのは「ゲート 3 に該当して `df:blocked` を付けるとき」だけ。それ以外で停止・質問しない。
  - **権限プロンプトを増やさない**: Bash は上記 `allowed-tools` に列挙した範囲で実行する。とくに複合コマンド（`&&` / `;` / パイプ）は各サブコマンドが分割判定されるため、**許可リスト外のコマンドを混ぜない**（混ぜると全体がプロンプトになる）。診断は `which` / `echo` / `node` / `cat` / `head` / `ls` / `corepack` / `volta` など許可済みのものを使い、迷う複合ワンライナーは小さな単一コマンドに分割して実行する。

---

## 🛑 絶対安全ゲート（最優先・例外なし）

このコマンドの最重要事項。**1 つでも破ったら事故**。各フェーズの前後でこれらを満たすか必ず確認し、満たさない／違反しそうなら**推測で進めず停止して報告**すること。

> ⚠️ **重要な前提**: このリポジトリは `main`・`develop` ともに **branch protection が未設定**の可能性がある（実測時は `gh api .../branches/main/protection` → 404 Branch not protected）。
> つまり GitHub 側に「main への push を弾く」「CI 緑でないとマージできない」という機械的な番人が**存在しない**ことがある。
> ゲート 1・2 を守る砦は **本コマンドの手順とあなたの遵守だけ**。確認を 1 つでも省くと、技術的に何でも通ってしまう。**省略は厳禁**。

1. **`main` へは push も merge も PR マージもしない。** 本番昇格（`develop → main`）は人間のみ。AI がマージしてよいのは **`develop` への実装 PR だけ**。
   - **理由を問わず実行禁止のコマンド例**:
     - `git push <remote> <任意>:main`（例 `git push origin HEAD:main`, `git push origin develop:main`）
     - `git push --force` / `git push -f`（あらゆるブランチに対して）
     - base が `main` の PR への `gh pr merge`
     - `develop → main` 昇格 PR の **作成も**マージも
   - `gh pr merge` の直前に対象 PR の base が `develop` であることを必ずプログラム的に確認し（後述・目視に頼らない）、`develop` 以外なら**即中止**。
2. **実装 PR は「CI 緑」かつ「レビュー指摘ゼロ」に収束するまでマージしない。** どちらか未達ならマージせず、修正を続けるか `df:blocked` で停止。CI 緑の判定基準はフェーズ B ステップ 5 に厳密に従う（branch protection が無いため GitHub 側では弾かれない＝確認は完全に本コマンドの責務）。
3. **判断不能・曖昧・受け入れ条件が書けない・自力で解消できない指摘がある → 推測しない。** `df:blocked` を付け、理由を Issue にコメントして**停止**する（後述「ブロック手順」）。
4. **TDD 厳守（`CLAUDE.md`）**: まずテストを書く → 失敗を確認 → コミット → 最小実装で緑。**実装中はテストを変更しない**。lint も通す。
5. **ブランチ命名**: 実装 `feature/issue-<N>`（設計専用ブランチは作らない＝設計書は実装ブランチに同梱）。**コミット規約**: `feat:` / `fix:` / `refactor:` / `docs:` / `config:` / `test:` / `style:`。
6. **`df:done` / `df:blocked` の Issue には着手しない。** これらは「人間の番」。**他の df ラベルが併記されていても**着手禁止。一覧で「人間の番」と報告するだけ。
7. **作業ツリーを壊さない。** 着手前に `git status` がクリーンであることを確認する。未コミットの変更があれば `git switch` で人間の作業を巻き込む恐れがあるため、**着手せず報告して終了**する（`df:blocked` ではなく単なる no-op 報告）。
8. **既存グローバル `/auto-task` は流用しない**（ゲート無視で即マージ・main も触りうるため）。本コマンドの手順とゲートのみに従う。

> 迷ったら止まる。推測で `main` を触る・CI 未確認でマージするくらいなら、`df:blocked` を付けて人間に渡すのが常に正しい。

---

## ラベル状態機械（誰の番か）

| ラベル | 次に動く担当 | このコマンドの動作 |
|--------|--------------|---------------------|
| `df:todo` | 🤖 AI（実装〜マージ） | フェーズ A（設計書 + TDD 実装 → 実装 PR）→ 続けてフェーズ B（レビュー → develop マージ）→ `df:done` |
| `df:dev-review` | 🤖 AI（レビュー〜マージ） | フェーズ B のみ（前回が PR 作成まで進んで止まった場合の再開） |
| `df:done` | 👤 人間 | **着手しない**（報告のみ） |
| `df:blocked` | 👤 人間 | **着手しない**（明示指示が無い限り報告のみ） |

> human-gate ラベル（`df:done` / `df:blocked`）は、他の df ラベルと**併記**されていても常に優先して「人間の番」と判定する。
> `df:dev-review` は通常 1 回の実行内でフェーズ A から自動的に通過する中間状態。独立して残っているのは「前回 PR 作成後にマージ前で停止した」場合で、その再開口として使う。

---

## STEP 0 — 状況把握とガード（必ず最初に実行）

1. リポジトリと既定ブランチを確認: `gh repo view --json nameWithOwner,defaultBranchRef -q '"\(.nameWithOwner) default=\(.defaultBranchRef.name)"'`
2. **作業ツリーのクリーン確認（ゲート 7）**: `git status --porcelain` を実行。
   - 出力が**空でない（未コミットの変更がある）** → 本コマンドはブランチを `git switch` するため、人間の作業を巻き込む恐れがある。**着手せず**「作業ツリーに未コミットの変更があるため /df を実行しません。コミット or stash してから再実行してください」と報告して終了。
   - マージ/リベース進行中・`.git` 破損などの異常が見えた場合も同様に停止・報告。
3. **ブランチ保護の実在確認（ゲート 1 の技術的裏付けチェック）**: `gh api repos/<owner>/<repo>/branches/main/protection 2>&1`
   - **404（Branch not protected）が返る = main にブランチ保護が無い**。この場合、ゲート 1（main を触らない）を機械的に強制する番人が存在しないことを最終報告に明記し、push/merge 系操作を一層慎重に扱う（禁止コマンド例を再確認する）。
   - `develop` についても同様（保護が無ければ CI 緑・指摘ゼロの確認は完全に本コマンドの責務）。
4. 最新化: `git fetch --all --prune`
5. Open Issue を一覧化:
   ```
   gh issue list --state open --limit 100 \
     --json number,title,labels,createdAt,updatedAt \
     -q 'sort_by(.createdAt)[] | "\(.number)\t\(.title)\t[\([.labels[].name] | join(","))]"'
   ```

取得した一覧を各 Issue の `df:*` / `priority/*` ラベルで分類し、**最初に状況テーブルを必ず提示**する（これは最終報告にもそのまま使う）:

| # | タイトル | df ラベル | 優先度 | 次の担当 | AI 実行可能 |
|---|----------|-----------|--------|----------|:----------:|

- **AI 実行可能**（着手対象）= `df:todo` / `df:dev-review` のいずれか **かつ** `df:done` / `df:blocked` をいずれも持たない。
- **人間の番**（着手しない）= `df:done` / `df:blocked` を 1 つでも持つ。「👤 人間」と明記。
- `df:*` ラベル無し = 対象外（「未分類」として軽く触れる）。

---

## STEP 1 — 対象 Issue の決定

### 1-A. 引数で番号が指定されている場合（`$1` あり）

1. 対象を取得: `gh issue view $1 --json number,title,body,labels,state`
2. 判定（**上から順に評価し、最初に該当した分岐で確定・終了する＝短絡評価**。とくに `df:done` / `df:blocked` を 1 つでも含む場合は、他の df ラベルが併記されていても着手しない）:
   - `closed` → 何もしない旨を報告して終了。
   - **`df:done` / `df:blocked` を 1 つでも含む** → **着手禁止**。「これは人間の番」と理由付きで報告して終了（ゲート 6）。
   - `df:*` ラベル無し → 着手せず「Dark Factory のラベルが付いていません（`df:todo` 等の付与が必要）」と報告して終了。
   - **AI 実行可能 df ラベル（`df:todo` / `df:dev-review`）が 2 つ以上付いて状態が矛盾** → どのフェーズが正しいか不定なので、フェーズを実行せずゲート 3 に従い `df:blocked` を付けコメントして停止。
   - `df:todo` → **フェーズ A**（実装）から開始し、続けてフェーズ B（レビュー → マージ）まで完走する。
   - `df:dev-review` → **フェーズ B**（レビュー → マージ）のみ実行する。

### 1-B. 引数が無い場合（自動選択）

対象は **AI 実行可能ラベル**（`df:todo` / `df:dev-review`）のいずれかを持ち、**かつ `df:done` / `df:blocked` を持たない** Open Issue のみ。

1. **候補集合のフィルタ**: Open Issue から、`df:done` / `df:blocked` を 1 つでも含む Issue を**除外**する。残った中で AI 実行可能 df ラベルを持つものだけを候補にする。

2. **優先順位**（上から順に評価し、最初に 1 件決まったら確定）:
   1. **緊急度優先**: `priority/critical` を最優先、次に `priority/high`。
   2. 同優先度内では **「進行中の作業を先に終わらせる」**（フェーズ進捗度の降順）: `df:dev-review`（あと一歩でマージ）＞ `df:todo`（起点）。
      - 根拠: 仕掛かり（WIP）を減らすほどリードタイムが短くなり、未マージの実装 PR が古びてコンフリクトする事故を防げる。「終わりに近いものから片付ける」。
   3. それでも同点なら **`createdAt` が古い順**（FIFO。滞留 Issue の飢餓＝永久放置を防ぐ）。

3. **矛盾検出ガード**（1-A と同一の安全弁）: 優先順位評価で 1 件に絞り込んだ直後、その Issue が **AI 実行可能 df ラベルを 2 つ以上**同時に持って状態が矛盾している場合（例: `df:todo` + `df:dev-review`）は、フェーズを実行せずゲート 3 に従い `df:blocked` を付けコメントして停止する。

> **本コマンドは 1 回の実行で 1 Issue を最後まで（`df:todo` → `df:done`）完走する。**
> ただし副作用の大きい操作（PR 作成・マージ・ラベル遷移）を含むため、**1 回の実行で扱う Issue は 1 件だけ**。複数 Issue を続けて処理したい場合は人間が `/loop /df` や `/schedule` で繰り返し起動する（`docs/dark-factory-workflow.md` §5 方式 B）。

決定したら、**選んだ Issue 番号・現ラベル・実行フェーズ・選定理由**を一言で宣言してから着手する。
AI 実行可能 Issue が 1 件も無ければ、STEP 0 の表とともに「現在 AI の番の Issue はありません（全て人間ゲート待ち、または Open Issue 無し）」と報告して終了。

---

## STEP 2 — フェーズ実行

着手前に必ず `gh issue view <N> --json number,title,body,labels` で本文・受け入れ条件・コメントを読む。

> 🔁 **再入可能性（idempotency）の共通ルール**: 本コマンドは `/loop` 等で反復起動される前提。ブランチ／PR を作る前に「既存のブランチ・PR」を必ず確認し、あれば作り直さず再利用する（手順は各フェーズに明記）。状況が不一致なら作り直さず「ブロック手順」へ。
>
> 🌿 **作業ブランチの扱い（worktree は使わない）**: `feature/issue-<N>` を直接 checkout して作業する。STEP 0 でクリーンを確認済みなので `git switch` してよい。フェーズ完了後（マージ後／ブロックで停止時）は **`develop` に戻す**（`git switch develop`）。

---

### 🅰 フェーズ A — 設計書 + TDD 実装 → 実装 PR（トリガー: `df:todo`）

> 🤖 AI（実装）。設計書を実装ブランチに同梱し、TDD で実装して develop 向けの実装 PR を出す。**完了後そのままフェーズ B に続ける。**

1. **入力を読む**: Issue 本文・受け入れ条件、`concept.md`、関連 ADR（`docs/adr/*.md`）、既存コードを読む。**ADR の決定が「正本」**。反する設計はしない（client→common / server→common の一方向依存を守る）。
2. **判断ゲート（ゲート 3）**: 目的・スコープ・受け入れ条件を**テストに落とせる粒度で設計・実装できるか**確認する。情報が決定的に不足／要件が矛盾・曖昧で**受け入れ条件を書けない** → 捏造せず「ブロック手順」へ。
3. **既存 PR / ブランチの確認（再入チェック）**:
   ```
   gh pr list --head feature/issue-<N> --state open --json number,url,baseRefName -q '.[]'
   git ls-remote --heads origin feature/issue-<N>
   ```
   - 同 Issue の open な実装 PR が**既にある** → フェーズ A はスキップし、**フェーズ B（レビュー → マージ）へ直行**する（PR 作成済み）。
   - PR は無いが実装ブランチだけある → その既存ブランチを再利用して実装を継続する。base が `develop` でない／状況が手順と不一致なら「ブロック手順」へ。
4. **実装ブランチを用意**（worktree は使わず直接 checkout。STEP 0 でクリーン確認済み）:
   ```
   git fetch origin --prune
   git switch develop
   git pull --ff-only
   # 既存ブランチがあれば再利用、無ければ develop から作成
   git show-ref --verify --quiet refs/heads/feature/issue-<N> && git switch feature/issue-<N> || git switch -c feature/issue-<N>
   ```
   remote にだけブランチがある場合は `git switch feature/issue-<N>`（追跡ブランチを自動作成）でよい。checkout に失敗したら続行せず「ブロック手順」へ。
5. **設計書を生成**: `docs/design/issue-<N>.md` を以下テンプレート（`docs/dark-factory-workflow.md` §6 準拠）で作成（`docs/design/` が無ければ作る）。**受け入れ条件はテストに落とせる粒度**で書く。**独立した設計 PR は作らない**（この実装ブランチに同梱する）。
   ```markdown
   # 設計書: <Issue題名> (#N)

   ## 1. 目的 / 背景
   ## 2. スコープ（やること / やらないこと）
   ## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）
   ## 4. 設計方針（アーキ・データ構造・主要モジュール）
   ## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）
   ## 6. テスト計画（TDDで書くテスト一覧）
   ## 7. リスク・未決事項
   ```
   ```
   git add docs/design/issue-<N>.md
   git commit -m "docs: Issue #<N> の設計書を追加"
   ```
6. **TDD サイクル（ゲート 4 厳守）**:
   - a. 受け入れ条件を入出力に落とし、**まずテストを書く**（実装は書かない）。ドメインロジックは原則 `common/` に置き TDD（`CLAUDE.md` のワークスペース境界・依存方向を守る）。
   - b. テストを実行し**失敗を確認**する。
   - c. ここで一度コミット（`test: Issue #<N> の受け入れ条件のテストを追加`）。
   - d. テストを通す**最小実装** → 緑にする。**実装中はテストを変更しない**。
   - e. 全テスト緑 + **lint** 通過まで反復。機能単位で細かくコミット（規約はゲート 5）。
   > テスト/ビルド/lint コマンドは `package.json` の scripts 等を `Read`/`Glob` で調べて使う（`pnpm test` / `pnpm lint` 等、`CLAUDE.md`「ツールチェーン」参照）。**このリポジトリはまだ未セットアップの可能性が高い**（実測: ルートに `package.json` 無し）: テスト/lint コマンドが特定できず検証不能、またはスコープ外の大規模セットアップが必要なら、推測で進めず「ブロック手順」へ。
7. **push** し、**実装 PR を作成**（base が `develop` であることを必ず確認＝ゲート 1。本文に `Closes #N` + 設計判断の要点 + テスト結果サマリ。設計書も差分に含まれる）:
   - PR タイトルの `<type>` は**主たる変更の性質**で選ぶ（新機能=`feat` / 設定・基盤整備=`config` / バグ修正=`fix` / ドキュメント=`docs` / リファクタ=`refactor` 等）。
   ```
   git push -u origin feature/issue-<N>
   gh pr create --base develop --head feature/issue-<N> \
     --title "<type>: <Issue題名> (#<N>)" \
     --body "$(cat <<'EOF'
   ## 概要
   Issue #<N> を実装しました。設計書 docs/design/issue-<N>.md を同梱します。

   ## 設計判断の要点
   - <設計上の主要な選択・トレードオフを箇条書き>

   ## 変更内容
   - <主要な変更点を箇条書き>

   ## テスト結果（TDD）
   - 追加テスト: <件数・概要>
   - 実行結果: ✅ 全テスト緑 / lint ✅
   - 実行コマンド: `<test コマンド>` / `<lint コマンド>`

   ## 受け入れ条件チェック
   - [x] <設計書 §3 の各条件を満たしたことを列挙>

   ## レビュー / マージ方針
   AI が /code-review でセルフレビューし、指摘収束 + CI 緑で develop へマージします（人間承認なし）。

   Closes #<N>
   EOF
   )"
   ```
8. **ラベル遷移**:
   ```
   gh issue edit <N> --remove-label "df:todo" --add-label "df:dev-review"
   ```
9. **そのまま続けてフェーズ B（レビュー → マージ）へ進む。** ここで停止しない。

---

### 🅱 フェーズ B — セルフレビュー → 修正 → develop マージ（トリガー: `df:dev-review`、またはフェーズ A から継続）

> 🤖 AI（レビュー）。指摘を収束まで修正し、**CI 緑 かつ 指摘ゼロ**でのみ develop へマージ。

1. **対象の実装 PR を特定**（本文に `Closes #<N>`、base `develop`）:
   ```
   gh pr list --state open --base develop --head feature/issue-<N> --json number,url,baseRefName,headRefName -q '.[]'
   ```
   見つからない／特定できない → 「ブロック手順」へ（実装 PR 未作成。`df:dev-review` 単独で来てここに該当する場合はフェーズ A 未完の可能性／ゲート 3）。
   **PR の base が `main` だった場合は即停止・ブロック**（ゲート 1。実装 PR は必ず develop ベース）。
2. **実装ブランチを最新化**（フェーズ A から継続している場合は既に checkout 済み。`df:dev-review` から開始した場合は checkout する）:
   ```
   git switch feature/issue-<N>
   git pull --ff-only
   ```
3. **セルフレビュー**: `/code-review`（`code-review:code-review` スキル）で実装 PR をレビューする（`--fix` で作業ツリーに適用してもよい）。
4. 指摘（バグ・簡素化・効率・設計逸脱）を**自分で修正してコミット・push**（`fix:` / `refactor:`）。**指摘が無くなる（収束する）まで 3〜4 を反復**。
   - 反復しても解消できない・設計どおりか確信が持てない指摘が残る → 捏造修正をせず「ブロック手順」へ（ゲート 3）。
5. **マージ前ゲート（ゲート 1・2 / 全て満たすこと。branch protection が無いため確認は完全に本コマンドの責務）**:
   - **(a) base が `develop`**（`main` でない）であること（最終確認はステップ 6 のマージ連鎖で再度プログラム的に行う）。
   - **(b) CI チェックの判定**: チェックの**件数とステートを分けて**判定する。曖昧に「pass っぽい」で進めない。
     ```
     gh pr checks <PR> --json name,state -q '.[] | "\(.state)\t\(.name)"'
     ```
     - 出力（= JSON 配列）の**要素数が 0** → **CI 未設定**。external チェックも含めて 1 件も無い場合は「緑」とみなさない（下記 (c) の補足も参照）。
     - 要素が **1 件以上あり、いずれかが `pending` / `in_progress`** → まだ緑ではない。`gh pr checks <PR> --watch` で完了を待つ（待っても収束しない／長時間なら「ブロック手順」へ）。
     - 要素が **1 件以上あり、全て `success`（pass）** → CI 観点は緑。ただし (c) を必ず確認。
     - 参考: `gh pr checks <PR>` の終了コードは概ね `0`=全 pass / `8`=pending / `1`=fail。fail・pending が 1 つでもあればマージしない。
   - **(c) 「プロジェクトの test/lint を実際に走らせる CI チェック」が存在するかの確認（重要）**:
     - GitGuardian 等の**セキュリティスキャンや外部アプリのチェックだけ**で、`test` / `lint` を走らせる CI が 1 つも無い場合は、それを**“CI 緑”とみなさない**。
     - その場合は `package.json` の `scripts`（`test` / `lint`）を `Read`/`Glob` で探してローカル実行し、**全緑を確認できたときのみ**マージ可。
     - `package.json` が無い／test・lint コマンドが特定できない／ローカル実行が不能 → **「ブロック手順」へ**。外部チェックの `pass` だけでマージしてはいけない。
   - **(d) レビュー指摘ゼロ**に収束していること。
6. **すべて満たしたら develop へマージ**（目視に頼らず、base==develop を満たしたときのみ merge が走る**単一コマンド連鎖**で実行する＝ゲート 1）:
   ```
   BASE=$(gh pr view <PR> --json baseRefName -q .baseRefName); \
   [ "$BASE" = develop ] && gh pr merge <PR> --squash --delete-branch \
     || echo "base=$BASE のためマージ中止（ゲート1: develop 以外には絶対マージしない）"
   ```
   `base=develop` 以外（特に `main`）なら**マージは実行されず中止**される。中止された場合はそのまま停止・報告する。
7. **ラベル遷移**（本番昇格は人間ゲートなのでここで止める）:
   ```
   gh issue edit <N> --remove-label "df:dev-review" --add-label "df:done"
   gh issue comment <N> --body "🤖 実装 → セルフレビュー（/code-review 指摘ゼロ）→ CI緑（test/lint）を確認し、実装 PR <PR-URL> を develop へマージしました（\`df:done\`）。本番反映（develop → main の昇格）は👤人間の番です。"
   ```
8. **後片付け**: `git switch develop` で develop に戻す（必要なら `git pull --ff-only`）。マージで remote ブランチは削除済み。用済みのローカル実装ブランチが残っていれば掃除してよい（`feature/issue-*` に限定）:
   ```
   git switch develop
   git branch -D feature/issue-<N> 2>/dev/null || true
   ```

**`develop → main` の昇格 PR は作らない・マージしない（人間のみ＝ゲート 1）。** STEP 3 の報告へ。
（任意）最終報告の「残候補／推奨」に **「develop・main に branch protection を設定すること」** を人間向け改善提案として添えてよい。

---

## ブロック手順（共通: 判断不能・自力解消不能なとき / ゲート 3）

該当したら**推測で進めず**以下を行い停止する。

```
gh issue edit <N> --add-label "df:blocked"
gh issue comment <N> --body "$(cat <<'EOF'
🤖 自力で解消できないため `df:blocked` を付けました。👤人間の判断をお願いします。

## どのフェーズで止まったか
<実装 / レビュー>

## 詰まっている点（具体的に）
- <曖昧な要件 / 矛盾 / 検証不能なコマンド / 解消不能な指摘 / 状態ラベル矛盾 など>

## 必要な判断 / 知りたいこと
- <人間に答えてほしい問い>
EOF
)"
```

- 進行中ラベル（`df:todo` / `df:dev-review`）を外すかは状況次第。**勝手に AI の番のまま放置せず**、`df:blocked` を**併記**して人間に委ねる（次回以降は `df:blocked` を含むため「人間の番」と判定され AI は再着手しない＝意図した動作）。
- **ブロック時の作業ブランチ**: コミット済みの途中成果はそのままブランチ（必要なら push）に残す。**`develop` に戻してよい**が、未コミットの変更があると `git switch` できないので、その場合は WIP コミット（`wip: Issue #<N> 途中成果`）してから戻すか、ブランチに留まったまま報告する。最終報告に作業ブランチ名を明記する。

報告では「`df:blocked` にした Issue 番号・止まったフェーズ・理由・人間に必要な判断・作業ブランチ名」を明記する。

---

## STEP 3 — 最終報告（毎回必ず出力）

1. **状況サマリ表**（STEP 0 の「誰の番か」分類テーブル: # / タイトル / df ラベル / 優先度 / 次の担当 / AI 実行可能）。
2. **ブランチ保護の状態**: STEP 0 で確認した main/develop の protection 有無を 1 行で（無い場合「ゲート 1・2 は本コマンドの遵守のみが砦」と明記）。
3. **選定と処理内容**: 処理した Issue 番号・タイトル・実行フェーズ（A→B / B のみ）・選定理由（引数指定ならその旨）。作成/更新した成果物（設計書パス・PR URL・コミット・テスト/CI 結果）。**作業した feature ブランチ名と、develop に戻したか／ブロックで残置したか**。
4. **ラベル遷移**: `旧ラベル → 新ラベル`。
5. **次のアクション**: 次に動くのは AI か人間か（人間ゲートなら何を待っているか / AI の番なら次回 `/df` で処理される旨）。
6. **AI 実行可能な残候補**（あれば優先度順。`/loop /df` や `/schedule` で連続実行する人間向け）。任意で **branch protection 設定の推奨**を添える。
7. **ブロック/停止した場合**: 理由と人間に求める判断を明記。

> 着手対象が無かった場合・停止した場合も、上記 1・2・5・7 の形で「いま誰の番か」を必ず報告する。

---

## クイック判断フロー

```
STEP 0: 状況テーブルを出す（誰の番か分類）＋ git status クリーン確認（汚れていたら no-op 報告で終了）＋ main/develop の branch protection 確認（404=保護なし→慎重に）
   ↓
引数あり?
 ├ Yes → その Issue。短絡評価で上から判定:
 │        closed / human-gate(done/blocked 併記含む) / ラベル無し / AI実行可能df複数(矛盾)→blocked
 │        のいずれでもなければ: df:todo→フェーズA→B / df:dev-review→フェーズBのみ
 └ No  → 候補から done/blocked を除外 → 優先度(critical>high) →
            フェーズ(dev-review>todo) → 古い順 で1件 →
            絞り込み後にAI実行可能df複数(矛盾)なら blocked
            ↓
      ※ 作業は feature/issue-<N> ブランチで直接（worktreeなし・git switch）。完了後 develop に戻す。
      df:todo      → 既存PR/ブランチ確認 → (PRあれば B直行) → ブランチ用意 → 設計書commit → TDD実装(test先行→失敗→commit→最小実装→lint) → 実装PR(Closes #N, 設計書同梱) → df:dev-review → そのままB
      df:dev-review→ 実装PR特定 → code-review→修正→収束→(base=develop & CI=test/lint緑 & 指摘ゼロ)→[BASE==developの単一連鎖で]developへマージ → df:done → developに戻す
            ↓
      迷い/曖昧/受け入れ条件不可/自力解消不能/状態矛盾/外部チェックのみでtest-lint無し → どの局面でも df:blocked + コメントで停止（作業ブランチは残す）
            ↓
STEP 3: 最終報告（状況表 / 保護状態 / 処理内容 / ラベル遷移 / 次の担当 / 残候補）
```
