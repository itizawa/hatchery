---
description: Dark Factory ディスパッチャ。GitHub の Open Issue の df:* ラベルから「今 AI が何をすべきか」を自律判断し、最優先の AI 実行可能 Issue を正しいフェーズ（設計 / TDD実装 / レビュー→developマージ）で1件処理してラベルを安全に遷移させる。
argument-hint: "[Issue番号(省略可)]"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh pr checks:*), Bash(gh pr merge:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git status:*), Bash(git switch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git fetch:*), Bash(git pull:*), Bash(git ls-remote:*), Bash(git rev-parse:*), Bash(git show-ref:*), Bash(git worktree:*), Bash(cd:*), Bash(git push -u origin design/issue-*:*), Bash(git push origin design/issue-*:*), Bash(git push -u origin feature/issue-*:*), Bash(git push origin feature/issue-*:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git diff:*), Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Read, Write, Edit, Glob, Grep, Skill(code-review:code-review)
---

# /df — Dark Factory ディスパッチャ

あなたはこのリポジトリ（ai-workspace）の **Dark Factory ワークフローのディスパッチャ** です。
GitHub の Open Issue を確認し、各 Issue の `df:*` ラベルから「今 AI が何をすべきか」を自律判断し、
**最優先の AI 実行可能 Issue を 1 件**選び、正しいフェーズ（設計 / TDD実装 / レビュー→developマージ）を実行してラベルを次の状態へ遷移させます。

- 引数 `$ARGUMENTS` / `$1` に **Issue 番号があればその Issue を対象**にする。無ければ後述の自動選択ロジックで 1 件選ぶ。
- 正本は `docs/dark-factory-workflow.md` と `CLAUDE.md`。判断に迷ったら必ずこの 2 つを読んで従う。以下は単体で完走できるよう要点を自己完結させたもの。
- 会話・コメント・PR 本文・設計書はすべて **日本語**（このリポジトリの規約）。
- **実体作業（設計書生成・実装・テスト/lint・コミット・push）はすべて専用の git worktree 内で行い、ユーザーのメイン作業ツリー（カレントのチェックアウト）には一切触れない。** `git switch` でメインのブランチを切り替えない。これにより人間や別セッションが develop 上で並行作業していても干渉せず、`/loop` や複数同時実行でも安全。手順は「STEP 2 共通: 🌲 隔離ワークトゥリーで作業する」。

---

## 🛑 絶対安全ゲート（最優先・例外なし）

このコマンドの最重要事項。**1 つでも破ったら事故**。各フェーズの前後でこれらを満たすか必ず確認し、満たさない／違反しそうなら**推測で進めず停止して報告**すること。

> ⚠️ **重要な前提**: このリポジトリは `main`・`develop` ともに **branch protection が未設定**（実測: `gh api .../branches/main/protection` → 404 Branch not protected）。
> つまり GitHub 側に「main への push を弾く」「CI 緑でないとマージできない」という機械的な番人は**存在しない**。
> ゲート 1・3 を守る砦は **本コマンドの手順とあなたの遵守だけ**。確認を 1 つでも省くと、技術的に何でも通ってしまう。**省略は厳禁**。

1. **`main` へは push も merge も PR マージもしない。** 本番昇格（`develop → main`）は人間のみ。AI がマージしてよいのは **`develop` への実装 PR だけ**。
   - **理由を問わず実行禁止のコマンド例**:
     - `git push <remote> <任意>:main`（例 `git push origin HEAD:main`, `git push origin develop:main`）
     - `git push --force` / `git push -f`（あらゆるブランチに対して）
     - base が `main` の PR への `gh pr merge`
     - `develop → main` 昇格 PR の **作成も**マージも
   - `gh pr merge` の直前に対象 PR の base が `develop` であることを必ずプログラム的に確認し（後述・目視に頼らない）、`develop` 以外なら**即中止**。
2. **自分が作った設計を `df:approved` にしない。** 設計フェーズの最後は必ず `df:design-review` で止める（設計承認は人間ゲート）。`df:design-needed → df:approved` の遷移は AI 禁止。
3. **実装 PR は「CI 緑」かつ「レビュー指摘ゼロ」に収束するまでマージしない。** どちらか未達ならマージせず、修正を続けるか `df:blocked` で停止。CI 緑の判定基準はフェーズ C ステップ 5 に厳密に従う（branch protection が無いため GitHub 側では弾かれない＝確認は完全に本コマンドの責務）。
4. **判断不能・曖昧・受け入れ条件が書けない・自力で解消できない指摘がある → 推測しない。** `df:blocked` を付け、理由を Issue にコメントして**停止**する（後述「ブロック手順」）。
5. **TDD 厳守（`CLAUDE.md`）**: まずテストを書く → 失敗を確認 → コミット → 最小実装で緑。**実装中はテストを変更しない**。lint も通す。
6. **ブランチ命名**: 設計 `design/issue-<N>` / 実装 `feature/issue-<N>`。**コミット規約**: `feat:` / `fix:` / `refactor:` / `docs:` / `config:` / `test:` / `style:`。
7. **`df:design-review` / `df:done` / `df:blocked` の Issue には着手しない。** これらは「人間の番」。**他の df ラベルが併記されていても**着手禁止。一覧で「人間の番」と報告するだけ。
8. **既存グローバル `/auto-task` は流用しない**（ゲート無視で即マージ・main も触りうるため）。本コマンドの手順とゲートのみに従う。

> 迷ったら止まる。推測で `main` を触る・自分の設計を承認する・CI 未確認でマージするくらいなら、`df:blocked` を付けて人間に渡すのが常に正しい。

---

## ラベル状態機械（誰の番か）

| ラベル | 次に動く担当 | このコマンドの動作 |
|--------|--------------|---------------------|
| `df:design-needed` | 🤖 AI（設計） | フェーズ A（設計書 → 設計 PR → `df:design-review` で停止） |
| `df:design-review` | 👤 人間 | **着手しない**（報告のみ） |
| `df:approved` | 🤖 AI（実装） | フェーズ B（TDD 実装 → 実装 PR → `df:dev-review`） |
| `df:dev-review` | 🤖 AI（レビュー→修正→マージ） | フェーズ C（指摘収束 + CI 緑で develop へマージ → `df:done`） |
| `df:done` | 👤 人間 | **着手しない**（報告のみ） |
| `df:blocked` | 👤 人間 | **着手しない**（明示指示が無い限り報告のみ） |

> human-gate ラベル（`df:design-review` / `df:done` / `df:blocked`）は、他の df ラベルと**併記**されていても常に優先して「人間の番」と判定する。

---

## STEP 0 — 状況把握とガード（必ず最初に実行）

1. リポジトリと既定ブランチを確認: `gh repo view --json nameWithOwner,defaultBranchRef -q '"\(.nameWithOwner) default=\(.defaultBranchRef.name)"'`
2. **ブランチ保護の実在確認（ゲート 1 の技術的裏付けチェック）**: `gh api repos/<owner>/<repo>/branches/main/protection 2>&1`
   - **404（Branch not protected）が返る = main にブランチ保護が無い**。この場合、ゲート 1（main を触らない）を機械的に強制する番人が存在しないことを最終報告に明記し、push/merge 系操作を一層慎重に扱う（禁止コマンド例を再確認する）。
   - `develop` についても同様（保護が無ければ CI 緑・指摘ゼロの確認は完全に本コマンドの責務）。
3. **このコマンドはメインの作業ツリーを変更しない**（フェーズ作業は後述の専用 worktree 内だけで行う）。そのため**メインツリーに未コミットの変更があっても /df は実行してよい**（人間・別セッションの並行作業に干渉しない）。ただし `git status` でマージ/リベース進行中・`.git` 破損などの異常が見えたら、無理に操作せず理由を述べて停止・報告する。
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

- **AI 実行可能**（着手対象）= `df:design-needed` / `df:approved` / `df:dev-review` のいずれか **かつ** `df:design-review` / `df:done` / `df:blocked` をいずれも持たない。
- **人間の番**（着手しない）= `df:design-review` / `df:done` / `df:blocked` を 1 つでも持つ。「👤 人間」と明記。
- `df:*` ラベル無し = 対象外（「未分類」として軽く触れる）。

---

## STEP 1 — 対象 Issue の決定

### 1-A. 引数で番号が指定されている場合（`$1` あり）

1. 対象を取得: `gh issue view $1 --json number,title,body,labels,state`
2. 判定（**上から順に評価し、最初に該当した分岐で確定・終了する＝短絡評価**。とくに `df:blocked` / `df:design-review` / `df:done` を 1 つでも含む場合は、他の df ラベルが併記されていても着手しない）:
   - `closed` → 何もしない旨を報告して終了。
   - **`df:design-review` / `df:done` / `df:blocked` を 1 つでも含む** → **着手禁止**。「これは人間の番」と理由付きで報告して終了（ゲート 7。例: `df:approved` + `df:blocked` はここで止まる）。
   - `df:*` ラベル無し → 着手せず「Dark Factory のラベルが付いていません（`df:design-needed` 等の付与が必要）」と報告して終了。
   - **AI 実行可能 df ラベル（`df:design-needed` / `df:approved` / `df:dev-review`）が 2 つ以上付いて状態が矛盾**（例: `df:approved` と `df:dev-review` が同時）→ どのフェーズが正しいか不定なので、フェーズを実行せずゲート 4 に従い `df:blocked` を付けコメントして停止。
   - `df:design-needed` → **フェーズ A**へ。`df:approved` → **フェーズ B**へ。`df:dev-review` → **フェーズ C**へ。

### 1-B. 引数が無い場合（自動選択）

対象は **AI 実行可能ラベル**（`df:design-needed` / `df:approved` / `df:dev-review`）のいずれかを持ち、**かつ `df:blocked` が付いていない** Open Issue のみ。`df:design-review` / `df:done` / `df:blocked` を持つ Issue は（他の df ラベルが併記されていても）対象外。

1. **候補集合のフィルタ**: Open Issue から、`df:blocked` / `df:design-review` / `df:done` を 1 つでも含む Issue を**除外**する。残った中で AI 実行可能 df ラベルを持つものだけを候補にする。

2. **優先順位**（上から順に評価し、最初に 1 件決まったら確定）:
   1. **緊急度優先**: `priority/critical` を最優先、次に `priority/high`。
   2. 同優先度内では **「進行中の作業を先に終わらせる」**（フェーズ進捗度の降順）: `df:dev-review`（最終盤＝あと一歩でマージ）＞ `df:approved`（実装中）＞ `df:design-needed`（起点）。
      - 根拠: 仕掛かり（WIP）を減らすほどリードタイムが短くなり、未マージの実装 PR が古びてコンフリクトする事故を防げる。人間ゲート（設計レビュー・本番昇格）へ早く球を渡す。「終わりに近いものから片付ける」。
   3. それでも同点なら **`createdAt` が古い順**（FIFO。滞留 Issue の飢餓＝永久放置を防ぐ）。

3. **矛盾検出ガード**（1-A と同一の安全弁）: 優先順位評価で 1 件に絞り込んだ直後、その Issue が **AI 実行可能 df ラベルを 2 つ以上**同時に持って状態が矛盾している場合（例: `df:approved` + `df:dev-review`）は、フェーズを実行せずゲート 4 に従い `df:blocked` を付けコメントして停止する（1-A・1-B どちらの経路でも矛盾 Issue は必ず blocked に落ちる）。

> **本コマンドは 1 回の実行で 1 Issue・1 フェーズだけ**処理して報告し終了する。
> 根拠: 各フェーズは PR 作成・マージ・ラベル遷移など副作用が大きく、人間ゲート（設計レビュー / 本番昇格）や CI 待ちを挟むため、1 Issue の状態は実行のたびに変わる。1 件ずつ確実に遷移させ報告するほうが暴走時の影響範囲が小さく安全。全件連続処理が必要なら、人間が `/loop` や `/schedule` で本コマンドを繰り返し起動できる（`docs/dark-factory-workflow.md` §5 方式 B）。

決定したら、**選んだ Issue 番号・現ラベル・実行フェーズ・選定理由**を一言で宣言してから着手する。
AI 実行可能 Issue が 1 件も無ければ、STEP 0 の表とともに「現在 AI の番の Issue はありません（全て人間ゲート待ち、または Open Issue 無し）」と報告して終了。

---

## STEP 2 — フェーズ実行

着手前に必ず `gh issue view <N> --json number,title,body,labels` で本文・受け入れ条件・コメントを読む。

> 🔁 **再入可能性（idempotency）の共通ルール**: 本コマンドは `/loop` 等で反復起動される前提。各フェーズでブランチ／PR を作る前に「既存のブランチ・PR」を必ず確認し、あれば作り直さず再利用する（手順は各フェーズに明記）。状況が不一致なら作り直さず「ブロック手順」へ。

---

### 🌲 共通: 隔離ワークトゥリーで作業する（全フェーズ必須）

フェーズ A/B/C の実体作業（設計書の生成・実装・テスト/lint 実行・コミット・push）は、**ユーザーのメイン作業ツリーを一切触らない**よう、専用の git worktree の中だけで行う。**`git switch` でメインのチェックアウトのブランチを切り替えてはいけない**（人間や別セッションが develop 上で並行作業していても干渉しないため）。

`gh` / `git fetch` などの読み取り・情報取得（STEP 0・STEP 1・各フェーズの「既存 PR / ブランチ確認」）はカレントのまま実行してよい。**フェーズに入って書き込み系の作業をする直前に** worktree を用意し、その中へ `cd` してから進める。

#### worktree の用意（各フェーズ冒頭で実行）

`<BR>` はフェーズに応じて `design/issue-<N>`（設計）または `feature/issue-<N>`（実装）。worktree の置き場所は**リポジトリ外** `${ROOT}-df-<branch>`（例: `ai-workspace-df-design-issue-4`）。メインの作業ツリーを汚さず、**人間や別セッションが手動で作る worktree とは名前空間が別**なので、誤って他者の worktree を再利用・削除しない。

```bash
ROOT="$(git rev-parse --show-toplevel)"
N=<Issue番号>
BR="design/issue-$N"                 # フェーズ B/C では feature/issue-$N
WT="${ROOT}-df-${BR//\//-}"          # 例: /Users/itizawa/ai-workspace-df-design-issue-4
                                     # /df 専用・ブランチ別の名前空間（リポジトリ外。人間/別セッションの手動 worktree とは別物なので衝突・誤削除しない）

git fetch origin --prune

# worktree を用意してその中へ cd する。配列は使わず（sh/zsh 差を避ける）、
# 対象ブランチの所在で add を分岐（remote 直渡しによる detached HEAD を回避）。
# どこかが失敗したら「→ ブロック手順へ」を表示する＝そのシグナルが出たら続行しない。
if git worktree list --porcelain | grep -qFx "worktree $WT"; then
  cd "$WT" || echo "→ ブロック手順へ（cd 失敗）"                                  # /df が前回作った同ブランチの worktree を再利用
elif git show-ref --verify --quiet "refs/heads/$BR"; then
  git worktree add "$WT" "$BR" && cd "$WT" || echo "→ ブロック手順へ（add 失敗）"          # 既存ローカルブランチを checkout
elif git show-ref --verify --quiet "refs/remotes/origin/$BR"; then
  git worktree add --track -b "$BR" "$WT" "origin/$BR" && cd "$WT" || echo "→ ブロック手順へ（add 失敗）"  # remote から追跡ブランチ作成
else
  git worktree add -b "$BR" "$WT" develop && cd "$WT" || echo "→ ブロック手順へ（add 失敗）"  # develop から新規作成
fi
# add 失敗の典型は「対象ブランチが別 worktree に checkout 済み＝並行作業の疑い」。乗っ取らずブロックする。

# 必ず: 正常な worktree で、かつ想定ブランチに居ることを確認。どちらか欠ければ続行せずブロック手順へ。
git status >/dev/null 2>&1 && [ "$(git rev-parse --abbrev-ref HEAD)" = "$BR" ] \
  || echo "→ ブロック手順へ（$BR の worktree を正常に用意できていない）"
```

- これは `set -e` の単一スクリプトではなく、**1 ステップずつ実行して出力を確認しながら進める手順**。上のブロックの出力に `→ ブロック手順へ` が 1 つでも出たら（あるいは `git worktree add` がエラーを出したら）、**続行せず即「ブロック手順」を実行**する（その worktree は残して人間に委ねる）。
- 正常に用意できたら、以降そのフェーズの作業は**すべてこの worktree 内（`cd` 済み）**で行う。`git add`/`commit`/`push`・`gh pr create`・テスト/lint 実行もここから（`gh` は同一リポジトリとして認識される）。
- `<Issue番号>`（`$N`）は数値の Issue 番号に、`<BR>` はフェーズに応じた `design/issue-<N>` / `feature/issue-<N>` に置換して実行する。

#### フェーズ完了後のクリーンアップ

PR 作成済み or マージ済みで成果が remote に保存された後、メインを散らかさないよう片付ける:

```bash
cd "$ROOT"
# /df 専用 worktree であることを名前で検証してから削除（人間/別セッションの worktree を誤って消さない）
case "$WT" in
  *-df-design-issue-* | *-df-feature-issue-*)
    git worktree remove "$WT" --force || echo "worktree 削除失敗（残置）: $WT"
    git worktree prune ;;
  *) echo "想定外のパスのため worktree を削除しません: $WT" ;;
esac
# フェーズ C（マージ後）のみ: 用済みのローカル実装ブランチも掃除（feature/issue-* に限定）
case "$BR" in
  feature/issue-*) git branch -D "$BR" 2>/dev/null || true ;;
esac
```

- **ブロック／エラーで停止する場合は worktree を削除せず残す**（人間が途中成果を確認できるよう、最終報告に `$WT` のパスを明記）。
- `git worktree remove` / `git branch -D` は上記のとおり**パターン検証付き**で実行し、`-df-*-issue-*` 以外のパスや `feature/issue-*` 以外のブランチには絶対に破壊的操作をしない（変数汚染による誤爆防止）。

---

### 🅰 フェーズ A — 設計（トリガー: `df:design-needed`）

> 🤖 AI（設計）。成果物は **設計書 1 ファイル + develop 向け設計 PR のみ。コードは一切書かない。**

1. **入力を読む**: Issue 本文・受け入れ条件、`concept.md`、関連 ADR（`docs/adr/*.md`）、既存コードを読む。**ADR の決定が「正本」**。反する設計はしない（client→common / server→common の一方向依存を守る）。
2. **判断ゲート（ゲート 4）**: 目的・スコープ・受け入れ条件を**テストに落とせる粒度で設計できるか**確認する。情報が決定的に不足／要件が矛盾・曖昧で**受け入れ条件を書けない** → 設計を捏造せず「ブロック手順」へ。
3. **既存 PR / ブランチの確認（再入チェック）**:
   ```
   gh pr list --head design/issue-<N> --state open --json number,url,baseRefName -q '.[]'
   git ls-remote --heads origin design/issue-<N>
   ```
   - 同 Issue の open な設計 PR が既にある → 新規作成せず**その PR を続行対象**にする（設計書を更新するならステップ 4 以降を既存ブランチ上で行う）。base が `develop` でない／状況が手順と不一致なら「ブロック手順」へ。
4. **隔離 worktree を用意して入る**（「🌲 共通: 隔離ワークトゥリーで作業する」の手順を `BR="design/issue-<N>"` で実行）。**メインのチェックアウトは `git switch` しない。** 以降のステップ 5〜8 はこの worktree 内（`${ROOT}-df-<branch>`）で行う。既存ブランチがあれば再利用される。
5. **設計書を生成**: `docs/design/issue-<N>.md` を以下テンプレート（`docs/dark-factory-workflow.md` §6 準拠。§5 に対象ワークスペース注記のみ追加）で作成（`docs/design/` が無ければ作る）。**受け入れ条件はテストに落とせる粒度**で書く。
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
6. **設計書のみをコミット**（コードは含めない）して push:
   ```
   git add docs/design/issue-<N>.md
   git commit -m "docs: Issue #<N> の設計書を追加"
   git push -u origin design/issue-<N>
   ```
7. **設計 PR を作成**（ステップ 3 で既存 open PR が無かった場合のみ。base が `develop` であることを必ず確認＝ゲート 1。タイトル・本文規約厳守。本文は `Refs #N`、`Closes` ではない）:
   ```
   gh pr create --base develop --head design/issue-<N> \
     --title "Design: <Issue題名> (#<N>)" \
     --body "$(cat <<'EOF'
   ## 概要
   Issue #<N> の設計書を追加します。

   ## 設計書
   - docs/design/issue-<N>.md

   ## レビュー観点（人間ゲート）
   - 目的・スコープは妥当か
   - 受け入れ条件はテストに落とせる粒度か
   - 設計方針・影響範囲・ADR 整合に漏れはないか

   ## 承認後の流れ
   この設計 PR をマージし、Issue に `df:approved` を付けてください（設計承認は人間ゲートです）。

   Refs #<N>
   EOF
   )"
   ```
8. **ラベル遷移**（必ず `df:design-review` で止める。`df:approved` には**絶対しない**＝ゲート 2）:
   ```
   gh issue edit <N> --remove-label "df:design-needed" --add-label "df:design-review"
   gh issue comment <N> --body "🤖 設計フェーズ完了。設計書 docs/design/issue-<N>.md と設計 PR <PR-URL> を作成しました。設計レビュー（👤人間）をお願いします。承認・マージ後に \`df:approved\` を付与してください。"
   ```
9. **クリーンアップ**: 「🌲 共通」のクリーンアップ手順で worktree を片付ける（設計 PR が remote にあるので作業は失われない）。

**この時点で AI の仕事は終わり。人間の設計レビュー待ち。** STEP 3 の報告へ。

---

### 🅱 フェーズ B — TDD 実装 → 実装 PR（トリガー: `df:approved`）

> 🤖 AI（実装）。TDD で実装し、develop 向けの実装 PR を出す。

1. **設計書を読む**: `docs/design/issue-<N>.md` の受け入れ条件・テスト計画を確認。
   - 設計書が無い／受け入れ条件が実装できる粒度に無い → 推測で実装せず「ブロック手順」へ（ゲート 4）。設計承認済み＝設計 PR がマージされ正本が `develop` にあるはず。
2. **既存 PR / ブランチの確認（再入チェック）**:
   ```
   gh pr list --head feature/issue-<N> --state open --json number,url,baseRefName -q '.[]'
   git ls-remote --heads origin feature/issue-<N>
   ```
   - 同 Issue の open な実装 PR が既にある → 新規作成せず**その PR を続行対象**にする（必要なら既存ブランチ上で実装を継続）。base が `develop` でない／状況が手順と不一致なら「ブロック手順」へ。
3. **隔離 worktree を用意して入る**（「🌲 共通」の手順を `BR="feature/issue-<N>"` で実行）。**メインのチェックアウトは `git switch` しない。** 以降のステップ 4〜6（TDD・テスト/lint・コミット・push・PR 作成）はこの worktree 内（`${ROOT}-df-<branch>`）で行う。既存の実装ブランチがあれば再利用される。
4. **TDD サイクル（ゲート 5 厳守）**:
   - a. 受け入れ条件を入出力に落とし、**まずテストを書く**（実装は書かない）。ドメインロジックは原則 `common/` に置き TDD（`CLAUDE.md` のワークスペース境界・依存方向を守る）。
   - b. テストを実行し**失敗を確認**する。
   - c. ここで一度コミット（`test: Issue #<N> の受け入れ条件のテストを追加`）。
   - d. テストを通す**最小実装** → 緑にする。**実装中はテストを変更しない**。
   - e. 全テスト緑 + **lint** 通過まで反復。機能単位で細かくコミット（規約はゲート 6）。
   > テスト/ビルド/lint コマンドは `package.json` の scripts 等を `Read`/`Glob` で調べて使う（`pnpm test` / `pnpm lint` 等、`CLAUDE.md`「ツールチェーン」参照）。**このリポジトリはまだ未セットアップの可能性が高い**（実測: ルートに `package.json` 無し）: テスト/lint コマンドが特定できず検証不能、またはスコープ外の大規模セットアップが必要なら、推測で進めず「ブロック手順」へ。
5. **push** し、**実装 PR を作成**（ステップ 2 で既存 open PR が無かった場合のみ。base が `develop` であることを必ず確認＝ゲート 1。本文に `Closes #N` + テスト結果サマリ）:
   - PR タイトルの `<type>` は**主たる変更の性質**で選ぶ（新機能=`feat` / 設定・基盤整備=`config` / バグ修正=`fix` / ドキュメント=`docs` / リファクタ=`refactor` 等）。迷う場合は最も支配的なコミット種別に合わせる。
   ```
   git push -u origin feature/issue-<N>
   gh pr create --base develop --head feature/issue-<N> \
     --title "<type>: <Issue題名> (#<N>)" \
     --body "$(cat <<'EOF'
   ## 概要
   Issue #<N> を実装しました。設計書 docs/design/issue-<N>.md に基づきます。

   ## 変更内容
   - <主要な変更点を箇条書き>

   ## テスト結果（TDD）
   - 追加テスト: <件数・概要>
   - 実行結果: ✅ 全テスト緑 / lint ✅
   - 実行コマンド: `<test コマンド>` / `<lint コマンド>`

   ## 受け入れ条件チェック
   - [x] <設計書 §3 の各条件を満たしたことを列挙>

   ## レビュー / マージ方針
   AI が /code-review でセルフレビューし、指摘収束 + CI 緑で develop へマージします。

   Closes #<N>
   EOF
   )"
   ```
6. **ラベル遷移**:
   ```
   gh issue edit <N> --remove-label "df:approved" --add-label "df:dev-review"
   gh issue comment <N> --body "🤖 実装フェーズ完了。実装 PR <PR-URL> を作成しました。続いて AI がセルフレビュー → 修正 → CI緑 + 指摘ゼロで develop へマージします（\`df:dev-review\`）。"
   ```
7. **クリーンアップ**: 「🌲 共通」のクリーンアップ手順で worktree を片付ける（実装 PR が remote にあるので作業は失われない）。

STEP 3 の報告へ。**このまま続けてフェーズ C へ進まない**（1 実行 1 Issue 1 フェーズが原則。PR の CI が走る時間も考慮）。次回 `/df <N>` で `df:dev-review` として処理される。

---

### 🅲 フェーズ C — レビュー → 修正 → develop マージ（トリガー: `df:dev-review`）

> 🤖 AI（レビュー）。指摘を収束まで修正し、**CI 緑 かつ 指摘ゼロ**でのみ develop へマージ。

1. **対象の実装 PR を特定**（本文に `Closes #<N>`、base `develop`）:
   ```
   gh pr list --state open --base develop --head feature/issue-<N> --json number,url,baseRefName,headRefName -q '.[]'
   ```
   見つからない／特定できない → 「ブロック手順」へ（実装 PR 未作成。フェーズ B 未完の可能性／ゲート 4）。
   **PR の base が `main` だった場合は即停止・ブロック**（ゲート 1。実装 PR は必ず develop ベース）。
2. **隔離 worktree を用意して入り、最新化**（「🌲 共通」の手順を `BR="feature/issue-<N>"` で実行。既存の実装ブランチを checkout する形になる）。**メインのチェックアウトは `git switch` しない。** worktree 内で `git pull --ff-only` し最新化する。以降のレビュー・修正・マージ操作はこの worktree（`${ROOT}-df-<branch>`）から行う。
3. **セルフレビュー**: `/code-review`（`code-review:code-review` スキル）で実装 PR をレビューする（`--fix` で作業ツリーに適用してもよい）。
4. 指摘（バグ・簡素化・効率・設計逸脱）を**自分で修正してコミット・push**（`fix:` / `refactor:`）。**指摘が無くなる（収束する）まで 3〜4 を反復**。
   - 反復しても解消できない・設計どおりか確信が持てない指摘が残る → 捏造修正をせず「ブロック手順」へ（ゲート 4）。
5. **マージ前ゲート（ゲート 1・3 / 全て満たすこと。branch protection が無いため確認は完全に本コマンドの責務）**:
   - **(a) base が `develop`**（`main` でない）であること（最終確認はステップ 6 のマージ連鎖で再度プログラム的に行う）。
   - **(b) CI チェックの判定**: チェックの**件数とステートを分けて**判定する。曖昧に「pass っぽい」で進めない。
     ```
     gh pr checks <PR> --json name,state -q '.[] | "\(.state)\t\(.name)"'
     ```
     - 上の出力（= JSON 配列）の**要素数が 0** → **CI 未設定**。external チェックも含めて 1 件も無い場合は「緑」とみなさない（下記 (c) の補足も参照）。
     - 要素が **1 件以上あり、いずれかが `pending` / `in_progress`** → まだ緑ではない。`gh pr checks <PR> --watch` で完了を待つ（待っても収束しない／長時間なら「ブロック手順」へ）。
     - 要素が **1 件以上あり、全て `success`（pass）** → CI 観点は緑。ただし (c) を必ず確認。
     - 参考: `gh pr checks <PR>` の終了コードは概ね `0`=全 pass / `8`=pending / `1`=fail。fail・pending が 1 つでもあればマージしない。
   - **(c) 「プロジェクトの test/lint を実際に走らせる CI チェック」が存在するかの確認（重要）**:
     - GitGuardian 等の**セキュリティスキャンや外部アプリのチェックだけ**で、`test` / `lint` を走らせる CI が 1 つも無い場合は、それを**“CI 緑”とみなさない**（実測: このリポジトリには `.github/workflows` が無く、PR には外部の「GitGuardian Security Checks」が `pass` を返すが、これはテスト/lint ではない）。
     - その場合は `package.json` の `scripts`（`test` / `lint`）を `Read`/`Glob` で探してローカル実行し、**全緑を確認できたときのみ**マージ可。
     - `package.json` が無い／test・lint コマンドが特定できない／ローカル実行が不能 → **「ブロック手順」へ**（現状このリポジトリはルートに `package.json` が無いため、実装が無い限り基本的にここで blocked になる）。外部チェックの `pass` だけでマージしてはいけない。
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
   gh issue comment <N> --body "🤖 レビュー指摘ゼロ・CI緑（test/lint）を確認し、実装 PR <PR-URL> を develop へマージしました（\`df:done\`）。本番反映（develop → main の昇格）は👤人間の番です。"
   ```
8. **クリーンアップ**: マージ済みなのでメインから worktree を片付ける（「🌲 共通」の**パターン検証付きクリーンアップ**を実行＝`$WT` が `-df-*-issue-*` のときだけ `git worktree remove`、`$BR` が `feature/issue-*` のときだけローカルブランチ削除）。マージで remote ブランチは削除済み。

**`develop → main` の昇格 PR は作らない・マージしない（人間のみ＝ゲート 1）。** STEP 3 の報告へ。
（任意）最終報告の「残候補／推奨」に **「develop・main に branch protection を設定すること」** を人間向け改善提案として添えてよい。

---

## ブロック手順（共通: 判断不能・自力解消不能なとき / ゲート 4）

該当したら**推測で進めず**以下を行い停止する。

```
gh issue edit <N> --add-label "df:blocked"
gh issue comment <N> --body "$(cat <<'EOF'
🤖 自力で解消できないため `df:blocked` を付けました。👤人間の判断をお願いします。

## どのフェーズで止まったか
<設計 / 実装 / レビュー>

## 詰まっている点（具体的に）
- <曖昧な要件 / 矛盾 / 検証不能なコマンド / 解消不能な指摘 / 状態ラベル矛盾 など>

## 必要な判断 / 知りたいこと
- <人間に答えてほしい問い>
EOF
)"
```

> 進行中ラベル（例 `df:approved`）を外すかは状況次第。**勝手に AI の番へ戻さない**こと（人間が状態を把握できるよう、迷う場合は現ラベルを残し `df:blocked` を**併記**して人間に委ねる）。
> 注意: こうして `df:approved` + `df:blocked` のように併記された Issue は、次回以降の実行で **`df:blocked` を含むため必ず「人間の番」と判定され、AI は再着手しない**（STEP 0・1-A・1-B のフィルタで除外される）。これが意図した動作。

> **ブロック時は worktree を削除しない**（人間が途中成果を確認できるよう残す）。最終報告に残置した worktree のパス（`${ROOT}-df-<branch>`）を明記する。

報告では「`df:blocked` にした Issue 番号・止まったフェーズ・理由・人間に必要な判断・残した worktree のパス」を明記する。

---

## STEP 3 — 最終報告（毎回必ず出力）

1. **状況サマリ表**（STEP 0 の「誰の番か」分類テーブル: # / タイトル / df ラベル / 優先度 / 次の担当 / AI 実行可能）。
2. **ブランチ保護の状態**: STEP 0 で確認した main/develop の protection 有無を 1 行で（無い場合「ゲート 1・3 は本コマンドの遵守のみが砦」と明記）。
3. **選定と処理内容**: 処理した Issue 番号・タイトル・実行フェーズ（A/B/C）・選定理由（引数指定ならその旨）。作成/更新した成果物（設計書パス・PR URL・コミット・テスト/CI 結果）。**作業に使った隔離 worktree のパス（`${ROOT}-df-<branch>`）と、片付け済みか／ブロックで残置したか**。
4. **ラベル遷移**: `旧ラベル → 新ラベル`。
5. **次のアクション**: 次に動くのは AI か人間か（人間ゲートなら何を待っているか / AI の番なら次回 `/df` で処理される旨）。
6. **AI 実行可能な残候補**（あれば優先度順。`/loop /df` や `/schedule` で連続実行する人間向け）。任意で **branch protection 設定の推奨**を添える。
7. **ブロック/停止した場合**: 理由と人間に求める判断を明記。

> 着手対象が無かった場合・停止した場合も、上記 1・2・5・7 の形で「いま誰の番か」を必ず報告する。

---

## クイック判断フロー

```
STEP 0: 状況テーブルを出す（誰の番か分類）＋ main/develop の branch protection 確認（404=保護なし→慎重に）
   ↓
引数あり?
 ├ Yes → その Issue。短絡評価で上から判定:
 │        closed / human-gate(design-review/done/blocked 併記含む) / ラベル無し / AI実行可能df複数(矛盾)→blocked
 │        のいずれでもなければ単一の df ラベルでフェーズ確定
 └ No  → 候補から blocked/design-review/done を除外 → 優先度(critical>high) →
            フェーズ(dev-review>approved>design-needed) → 古い順 で1件 →
            絞り込み後にAI実行可能df複数(矛盾)なら blocked
            ↓
      ※ フェーズ作業は隔離worktree ${ROOT}-df-<branch> 内で実行（git switchでメインを切り替えない）。完了後にworktree片付け／ブロック時は残してパス報告。
      df:design-needed → worktree用意 → 既存PR/ブランチ確認 → 設計書+設計PR(Refs #N) → df:design-review で停止（approvedにしない／コード書かない）→ 片付け
      df:approved      → worktree用意 → 既存PR/ブランチ確認 → TDD実装(test先行→失敗→commit→最小実装→lint)+実装PR(Closes #N) → df:dev-review → 片付け
      df:dev-review    → worktree用意 → code-review→修正→収束→(base=develop & CI=test/lint緑 & 指摘ゼロ)→[BASE==developの単一連鎖で]developへマージ → df:done → 片付け
            ↓
      迷い/曖昧/受け入れ条件不可/自力解消不能/状態矛盾/外部チェックのみでtest-lint無し → どの局面でも df:blocked + コメントで停止（worktreeは残す）
            ↓
STEP 3: 最終報告（状況表 / 保護状態 / 処理内容 / ラベル遷移 / 次の担当 / 残候補）
```
