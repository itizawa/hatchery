# 設計書: Issue #285 — リサーチャー goal が競合調査・現状レビューから改善点を GitHub Issue として自律起票する

- 関連 Issue: #285
- 関連 ADR: ADR-0016（goal 出力契約）, ADR-0017（goal=issue へ Claude Agent SDK 採用）, ADR-0004（server 層分離・定時バッチ）, ADR-0011（Cloud Run）
- 依存 Issue（develop マージ済み確認）: #284（Channel goal 導入・goal 駆動 dispatch）, #287（ADR-0017）

## 目的

`goal=issue` のリサーチャーチャンネルが Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）を用いて、定時に
競合調査 + プロダクト状況レビューを行い、改善点を GitHub Issue として自律起票する。起票結果はチャンネルに
メッセージ（`issueNumber` / `issueUrl` 付き）として残す。

## 現状整理（既存土台）

- `server/src/batch/planningBatch.ts` … 自社ページ巡回 → `@anthropic-ai/sdk` 単発コールで UX 提案生成 →
  goal=issue チャンネルへ `createPlanningMessage` で保存。**外部リサーチ無し・自律起票無し**。
- `server/src/routes/planning-issues.ts` … 人間の 1 クリックで Octokit により Issue 起票 →
  `updateIssueRef` で書き戻し。**人間トリガ**。
- `server/src/utils/apiKey.ts` … `getApiKey()`（DB の `CLAUDE_API_KEY` 復号優先 → `ANTHROPIC_API_KEY` フォールバック）。
- `server/src/persistence/messageRepository.ts` … `createPlanningMessage` / `updateIssueRef`。
- goal 駆動 dispatch（#284）: バッチは `channel.goal.type` で対象を絞る（`chat` は `runAiMessageBatch`、
  `issue` は `planningBatch`）。

本 Issue は (1) 競合・市場の外部リサーチ（`WebSearch`/`WebFetch`）と (2) 出力としての自律 Issue 起票
（エージェントループ）を Agent SDK で埋める。既存 `planningBatch` は残置しつつ、新しい
`researcherBatch`（Agent SDK エンジン）を `goal=issue` の主経路として追加する。

## 設計判断（確定事項）

### 使用モデル

`claude-sonnet-4-5` を採用する。理由: リサーチ（複数 WebSearch/WebFetch のツールループ）＋提案の質を担保する
必要があり、`goal=chat` の `claude-haiku-4-5`（単発・安価）より上位が妥当。コストは `maxBudgetUsd` で上限管理する。
モデル ID は `RESEARCHER_MODEL` 環境変数で上書き可能とし、既定は `claude-sonnet-4-5`。

### ツール／権限スコープ（受け入れ条件 2）

```
permissionMode: "dontAsk"
allowedTools: ["WebSearch", "WebFetch", "mcp__hatchery_github__create_github_issue"]
```

- `Bash` / `Write` / ファイル操作等の広権限ツールは付与しない（`allowedTools` に列挙しない）。
- GitHub 起票は **生の GitHub MCP を直接渡さず**、自前の in-process MCP ツール
  `create_github_issue`（`createSdkMcpServer` + `tool()`）でラップする。これにより起票の決定性
  （重複防止・1 run 最大 N 件・ラベル/マイルストーン方針）をツール側で強制する（ADR-0017 (e)）。

### 重複防止・1 run 最大件数（受け入れ条件 4）

ツールスコープ（後処理ではなくツール内部）で強制する:

- **重複防止**: ツールは既存 open Issue のタイトル一覧（Octokit `issues.listForRepo`、本 run 起票分含む）と
  正規化（前後空白除去・小文字化）で照合し、一致したら起票せず `duplicate` を返す。
- **1 run 最大 N 件**: ツール内部のカウンタで `MAX_ISSUES_PER_RUN`（既定 3）を超えたら起票せず
  `limit_reached` を返す。エージェントの自由起票に委ねない。

### ラベル／マイルストーン方針（受け入れ条件 4 + 「df:todo 重要判断」）

このリポジトリでは `df:*` 状態ラベルは全廃済み（CLAUDE.md）。受け入れ条件 4 は当初 `df:todo` 付与を想定したが、
現行方針と整合させ **状態ラベルを付けない・マイルストーンも設定しない**（= 自動選択対象外の人間トリアージ待ち）。
起票時のラベル・マイルストーンは **付与しない**（空）。この判断を設計書に明記し、テストも「ラベル無し・
マイルストーン無し・df:todo を付けない」で検証する。

### コスト制御（受け入れ条件 5）

- `maxTurns`: 既定 30（`RESEARCHER_MAX_TURNS` で上書き可）。
- `maxBudgetUsd`: 既定 1.0 USD（`RESEARCHER_MAX_BUDGET_USD` で上書き可）。
- 超過時、SDK は `subtype: "error_max_turns" | "error_max_budget_usd"` の result メッセージを返す。
  バッチはこれを検知してそのチャンネルの処理を打ち切り、ログを残す（例外にしない）。

### 認証／スキップ（受け入れ条件 7）

- `ANTHROPIC_API_KEY`: `getApiKey(appSettingRepo)` で取得。未設定ならバッチ全体をスキップしログ。
- `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO`: いずれか未設定ならバッチ全体をスキップしログ
  （起票できないため）。

### 入力（受け入れ条件 1, 3）

- チャンネルの `goal.instructions`（任意）をエージェントのユーザープロンプトに反映する。
- プロダクト現状: 直近メッセージ（`listRecentByChannel`）＋ あらすじ（`getSummary`）＋ 自社 URL（`CLIENT_URL`）を
  プロンプトに含め、競合・市場は `WebSearch`/`WebFetch` でエージェントに取得させる。

### 出力（受け入れ条件 6）

起票ツールが起票に成功したら、その場で `createPlanningMessage`（proposal* に提案内容）→ `updateIssueRef`
（issueNumber / issueUrl）を行い、チャンネルにメッセージとして残す。`updateIssueRef` は既存実装を流用。

## アーキテクチャ（層・依存方向）

- 新規ユースケース: `server/src/batch/researcherBatch.ts`（Express を import しない・別エントリ前提）。
- 起票ツールのラッパー: `server/src/batch/githubIssueTool.ts`
  （Octokit 呼び出し＋ dedup/最大件数を内包する純粋寄りの関数 + `createSdkMcpServer` ツール定義）。
- エントリポイント: `server/src/batch/researcherIndex.ts`（`createPrismaDeps` で実 Prisma を注入）、
  `server/package.json` に `batch:researcher` script を追加。
- 依存方向は server → common の一方向を維持（client 非依存）。

### テスト容易性（受け入れ条件 8）

`researcherBatch` の deps に以下を注入可能にする（省略時は実 SDK / 実 Octokit）:

- `runQuery`: `(opts) => AsyncIterable<SDKMessage>` 相当の関数。テストでは SDK の `query()` をスタブし、
  エージェントが `create_github_issue` ツールを呼んだ体を再現する。
- `createIssue`: `(input) => Promise<{ status, issueNumber?, issueUrl? }>` の起票関数。
  テストでは Octokit を呼ばずスタブし、dedup / 最大件数のロジック自体は `githubIssueTool` の純粋関数で別途テストする。

実テストでは **実ネットワークに出ない**（query も Octokit も WebSearch/WebFetch もスタブ）。

## テスト計画（TDD・受け入れ条件 8）

### `githubIssueTool` 単体（dedup / 最大件数 / ラベル方針）

- (d) 同一タイトル（正規化一致）の提案は重複起票しない（`duplicate` を返し Octokit.create を呼ばない）。
- 1 run で `MAX_ISSUES_PER_RUN` を超えると `limit_reached` を返し起票しない。
- 起票時、Octokit `issues.create` に `labels` / `milestone` を渡さない（ラベル無し・マイルストーン無し）。

### `researcherBatch` 結合（query/issue をスタブ）

- (a) goal=issue チャンネルで query を実行し、エージェントが起票ツールを呼ぶと
  `createPlanningMessage` + `updateIssueRef` が呼ばれ、結果に issueNumber/issueUrl が載る。
- goal=chat のみならスキップ（空）。
- (b) query が `error_max_turns` / `error_max_budget_usd` の result を返したらそのチャンネルを打ち切り、
  打ち切りログを残す（例外にしない）。
- (c) ANTHROPIC_API_KEY 未設定 / GITHUB_TOKEN 等未設定でスキップ（query を呼ばない・空）。
- (d) エージェントが同一提案を 2 回起票しようとしても、ツールの dedup により 1 件だけ起票される。

## スコープ外

起票後の自動 `/df`、競合の自動発見、Issue 本文に受け入れ条件まで AI に書かせる高度化、投下文のモデレーション強化、
Cloud Run のメモリ設定変更（運用作業）。
