---
description: Dark Factory ワークフロー向けに GitHub Issue を起票する。ユーザーの要望（$ARGUMENTS）から、concept.md・ADR・既存コードを踏まえて「背景 / 目的 / 受け入れ条件（テストに落とせる粒度）/ 補足」構成の Issue 本文を起こし、df:todo + priority/* ラベルを付けて gh issue create する。実装はしない（起票のみ）。
argument-hint: "[作りたい Issue の概要・要望]"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue create:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git log:*), Bash(git diff:*), Bash(echo:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Bash(ls:*), Bash(wc:*), Bash(grep:*), Bash(find:*), Bash(sort:*), Bash(uniq:*), Read, Glob, Grep
---

# /create-issue — Dark Factory Issue 起票

あなたはこのリポジトリ（ai-workspace）の **Dark Factory ワークフローにおける Issue 起票担当** です。
人間（`$ARGUMENTS` の要望を出した本人）の代わりに、**AI が後で `/df` で実装着手できる粒度の Issue を 1 件作成**します。

- 正本は `docs/dark-factory-workflow.md`（フェーズ1「人間: Issue 起票」）と `CLAUDE.md`。迷ったら必ず読む。
- このコマンドは **起票のみ**を行う。**実装・ブランチ作成・PR・マージは一切しない**（それは `/df` の仕事）。
- Issue のタイトル・本文・コメントはすべて **日本語**（このリポジトリの規約）。
- `$ARGUMENTS` に作りたい Issue の概要・要望が入る。空なら、何を起票したいかユーザーに 1 度だけ尋ねて止まる。

---

## なぜ Issue 本文が重要か（最重要）

Dark Factory では **独立した設計 PR と人間の設計承認を廃止**している。そのため
**Issue 本文の「受け入れ条件」がそのまま実装の正本**になる。

> 受け入れ条件は **テストに落とせる粒度**で書く。曖昧だと AI（`/df`）が実装方針を確定できず `df:blocked` になり、人間に差し戻される。ここで具体的に書くほど自走率が上がる。

---

## STEP 0 — 既存コンテキストの把握

要望を Issue に落とす前に、関連する正本・既存実装を読む。**勝手に仕様を捏造しない**。

1. `concept.md`（プロダクト企画）と、関連しそうな `docs/adr/*.md`（技術決定の正本）を読む。
   - ADR の決定に反する要望なら、それを本文「補足」で明示し、必要なら別途 ADR 更新が要ることを書く。
2. `CLAUDE.md` の「アーキテクチャ」「バリデーションルール」を確認する。とくに:
   - 依存方向 **client → common / server → common の一方向**。
   - 型共有は **OpenAPI 一方向フロー**（common Zod → server openapi.json → client 型生成）。
   - **ユーザー入力の文字列フィールドは Zod `.max()` 必須**（フロントは `inputProps={{ maxLength }}` で二重防御）。
   - MVP 制約（社員3・チャンネル2・定時2回、タスクは `new`→`done`。経験値・進化・関係値は MVP 外）。
3. 要望に関係する既存コード・既存 Issue を軽く調べ、**参照実装（雛形）になりそうなファイル**を特定する（本文「補足」に具体パスで書くと `/df` が速い）。
   - `gh issue list --state all --search "<キーワード>"` で重複・関連 Issue を確認。重複しそうなら作らず、その旨をユーザーに伝える。

---

## STEP 1 — Issue 本文を起こす

既存 Issue（例: #153 / #147）と同じ構成で本文を組み立てる。**Markdown の見出しは下記に固定**する。

### タイトル

- **Conventional Commits のプレフィックス**を付ける: `feat:` / `fix:` / `refactor:` / `docs:` / `config:` / `chore:` / `test:` / `style:`。
- 「何を・どうする」が一読で分かる日本語にする（実装手段ではなく成果で書く）。

### 本文テンプレート

```markdown
## 背景

<なぜこれが必要か。現状の課題・関連する既存実装（具体ファイルパスや行）・concept.md / ADR との関係を書く>

## 目的

<この Issue が完了すると何が達成されるか。1〜2 文で成果を端的に>

## 受け入れ条件

1. <テストに落とせる粒度の条件。入出力・対象ファイル/層・守るべき制約（一方向 import / OpenAPI フロー / Zod .max() 等）を具体的に>
2. <…>
3. <最後に必ず: `pnpm turbo run build|test|lint` が緑。該当すれば一方向 import 境界やバリデーション規約の遵守も明記>

## 補足

- **雛形 / 参照実装**: <ほぼ流用できる既存ファイルを具体パスで>
- **依存関係**: <先行すべき Issue / 衝突しうる作業があれば>
- **スコープ外 / 将来拡張**: <今回やらないこと。別 Issue 候補>
- 関連: <関連ファイル・Issue 番号>
```

**受け入れ条件を書くときのチェック**:
- 各条が「テストで真偽を判定できる」か。できないなら分割・具体化する。
- 新規にユーザー入力の文字列フィールドが増えるなら **Zod `.max()` を条件に含める**。
- client / server / common / docs のどのワークスペースを触るか明記する。
- MVP 制約を超える要望なら、超える部分を「スコープ外 / 将来拡張」に切り出す。

---

## STEP 2 — ラベルを決める

- **状態ラベル `df:todo` を必ず付ける**（AI 着手待ちを表す。これが無いと `/df` が拾わない）。
- **優先度ラベル `priority/*` を 1 つ**付ける。要望の緊急度から判断し、不明なら `priority/medium`（デフォルト相当）。
  - `priority/critical`（緊急・最優先）/ `priority/high`（高）/ `priority/medium`（中）/ `priority/low`（低）。
- 必要なら `gh label list` で現在のラベルを確認する。`df:dev-review` / `df:done` / `df:blocked` は **起票時には付けない**（それぞれ後フェーズの状態）。

---

## STEP 3 — 起票前にユーザーへ提示・確認

実際に作成する前に、**タイトル・本文・付与ラベルをユーザーに提示**し、起票してよいか確認する。
- 修正要望があれば反映してから作成する。
- 「そのまま作って」と言われたら STEP 4 へ。
- 要望が `$ARGUMENTS` で十分明確かつ「作って」と読み取れる場合は、提示と同時に作成まで進めてよい（提示→即作成）。ただし重大な仕様の前提が不明なときは作成前に質問する。

---

## STEP 4 — 作成

`gh issue create` で起票する。本文はヒアドキュメントではなく `--body-file`（一時ファイル）でも `--body` でもよいが、**日本語と Markdown が壊れない**方法を使う。

```bash
gh issue create \
  --title "feat: <タイトル>" \
  --body "$(cat <<'EOF'
## 背景
...
## 目的
...
## 受け入れ条件
1. ...
## 補足
- ...
EOF
)" \
  --label "df:todo" \
  --label "priority/medium"
```

作成後:
- 返ってきた **Issue URL / 番号をユーザーに報告**する。
- 「この Issue を実装させるには `/df <番号>`（または引数なしの `/df`）を実行してください」と案内する。
- **このコマンドはここで終了**する。実装には入らない。

---

## やってはいけないこと

- ❌ 実装・テスト作成・ブランチ作成・コミット・PR・マージ（`/df` の領域）。
- ❌ `df:todo` 以外の状態ラベル（`df:dev-review` / `df:done` / `df:blocked`）を起票時に付ける。
- ❌ ADR / concept.md / MVP 制約に反する内容を、断り書きなく受け入れ条件に入れる。
- ❌ 受け入れ条件をテスト不能な曖昧表現のままにする。
- ❌ 既存 Issue と重複する内容を確認せず作る。
