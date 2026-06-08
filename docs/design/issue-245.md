# 設計書: `/goal` コマンドの設計・実装 (#245)

## 1. 目的 / 背景

現在 `/df` は Issue を 1 件ずつ処理するため、マイルストーン内の全 Issue を消化するには人間が繰り返し `/df` を呼び出す必要がある。
`/goal` コマンドはマイルストーン番号を引数に受け取り、対象の `df:todo` Issue を全件順次消化する自動化ハーネスを提供する。

## 2. スコープ

### やること
- `.claude/commands/goal.md` に `/goal <milestone>` コマンドを実装する
- Claude Code の Workflow `pipeline()` で `df:todo` Issue を優先度順に順次処理する
- 各 Issue の処理を独立したサブエージェントに委譲し、コンテキスト汚染を防ぐ
- エラー隔離（1 件が `df:blocked` になっても次の Issue に進む）
- 完了後にサマリ（処理済み / blocked / スキップの件数）を出力する

### やらないこと
- 並列実行（develop ブランチ競合防止のため `parallel()` は禁止）
- Slack 通知
- GitHub Actions との連携
- 複数マイルストーンの同時指定

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `.claude/commands/goal.md` ファイルが存在する
2. ファイルに YAML フロントマター（`description`・`argument-hint` フィールド）が含まれる
3. `pipeline()` というキーワードが含まれ、順次処理であることが明記される
4. `parallel()` 禁止（develop ブランチ競合防止）が明記される
5. 各サブエージェントに `/df` の安全ゲート（main 禁止・CI 緑必須・TDD 厳守・worktree 隔離）が渡されることが明記される
6. `df:blocked` になっても次の Issue に進む（エラー隔離）が明記される
7. 処理後にサマリ（処理済み / blocked / スキップ件数）を出力することが明記される
8. 対象マイルストーン外の Issue は処理しないことが明記される

## 4. 設計方針

### ファイル形式
`.claude/commands/df.md` と同じフォーマット（YAML フロントマター + Markdown 本文）で実装する。

### Workflow API の利用
Claude Code の Workflow `pipeline()` を使い、Issue を 1 件ずつ順次サブエージェントに渡す。
`parallel()` は develop ブランチへの同時 push が競合するため禁止。

### サブエージェントへのプロンプト
各サブエージェントには以下を含める:
- 対象 Issue 番号
- `/df` の安全ゲート全文（main 禁止・CI 緑必須・TDD 厳守・worktree 隔離）
- Dark Factory ワークフローの要点

### エラー隔離
`df:blocked` 状態になった Issue はスキップし、次の Issue に進む。
最終サマリで blocked 件数を報告する。

## 5. 影響範囲 / 既存への変更

- 新規追加: `.claude/commands/goal.md`
- 新規追加: `docs/design/issue-245.md`（本ファイル）
- 新規追加: `tests/goal-command.test.ts`
- 変更なし: 既存コマンド・ソースコード

## 6. テスト計画（TDD で書くテスト一覧）

`tests/goal-command.test.ts` に以下を実装する:

| テスト | 内容 |
|--------|------|
| ファイル存在確認 | `.claude/commands/goal.md` が存在する |
| フロントマター確認 | `description` フィールドが存在する |
| フロントマター確認 | `argument-hint` フィールドが存在する |
| pipeline 記載 | `pipeline()` キーワードが含まれる |
| parallel 禁止記載 | `parallel()` 禁止が明記される |
| 安全ゲート記載 | main 禁止の記載がある |
| CI 緑必須記載 | CI 緑必須の記載がある |
| エラー隔離記載 | `df:blocked` のエラー隔離が明記される |
| サマリ記載 | 処理済み / blocked / スキップのサマリ出力が明記される |
| マイルストーン絞り込み記載 | 対象マイルストーン外を処理しないことが明記される |

## 7. リスク・未決事項

- Workflow の `pipeline()` API はドキュメント化された正式機能であることを前提とするが、将来的に変更される可能性がある
- サブエージェントが `/df` を呼べないため、プロンプトに実装ロジックを直接記述する必要がある（Issue 本文の補足に記載済み）
