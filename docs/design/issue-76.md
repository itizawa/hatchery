# 設計書: 企画チャンネルを追加し、AIが定期的にUX改善Issueを提案する (#76)

## 1. 目的 / 背景

ADR-0009 の定時バッチ基盤を活用し、AI が定期的にアプリの各ページを巡回して UX 改善点を検出し、`企画` チャンネルへ投稿する。投稿されたメッセージから GitHub Issue を起票できる API エンドポイントを用意することで、「AI 提案 → Issue 積み上げ → Dark Factory で実装」のループを完結させる。

## 2. スコープ（やること / やらないこと）

### やること
- `planning` チャンネル種別の追加（Prisma enum + common Zod スキーマ）
- `企画` チャンネルのデフォルトチャンネルへの追加（seed 対象）
- Message モデルへの提案メタデータフィールド追加（Prisma + common スキーマ拡張）
- UX 提案バッチ（`planningBatch.ts`）: fetch + cheerio でページ取得 → Claude API で提案生成 → 企画 チャンネルへ永続化
- GitHub Issue 起票 API エンドポイント（`POST /channels/:channelId/messages/:messageId/create-issue`）: GITHUB_TOKEN で issue 作成 → メッセージに issueNumber/issueUrl を記録
- MessageRepository への `createPlanningMessage` / `updateIssueRef` メソッド追加

### やらないこと
- クライアント UI（ボタン等）の実装
- Playwright の導入（fetch + cheerio で代替）
- GitHub OAuth / Fine-grained token の管理 UI（環境変数 GITHUB_TOKEN のみ）
- Issue 作成後のチャンネル自動通知

## 3. 受け入れ条件（テストに落とせる粒度）

1. `ChannelTypeSchema` が `"planning"` を受け付け、`"invalid"` を拒否する
2. `DEFAULT_CHANNELS` に `{ id: "kikaku", label: "企画", type: "planning" }` が含まれる
3. `MessageRecordSchema` が `proposalTitle / proposalReason / proposalTargetUrl / issueNumber / issueUrl` の optional フィールドを持つ
4. `planningBatch` は fetch をモックしてページコンテンツを取得し、Claude API（モック）から UxProposal 配列を受け取り、`createPlanningMessage` を呼び出す
5. `planningBatch` は `ANTHROPIC_API_KEY` が未設定の場合にスキップし、エラーログを出す
6. `POST /channels/:channelId/messages/:messageId/create-issue` は 201 で GitHub Issue URL を返す（GitHub API モック）
7. `POST ...create-issue` は `GITHUB_TOKEN` が未設定の場合に 500 を返す
8. `POST ...create-issue` はメッセージが存在しない場合に 404 を返す
9. `POST ...create-issue` 成功後、メッセージの `issueNumber` / `issueUrl` が更新される
10. `turbo run lint test build` が緑（integration テスト除く）

## 4. 設計方針

### ChannelType 拡張
- `common/src/domain/channel/channel.ts` の `ChannelTypeSchema` に `"planning"` を追加
- `CHANNEL_IDS` / `DEFAULT_CHANNELS` に `"kikaku"` / `"企画"` を追加
- `server/prisma/schema.prisma` の `ChannelType` enum に `planning` を追加
- SeedPrisma インターフェースのチャンネル型も更新

### Message メタデータ拡張
- Prisma Message モデルに 5 つの optional フィールド追加:
  - `proposalTitle String?` / `proposalReason String?` / `proposalTargetUrl String?`
  - `issueNumber Int?` / `issueUrl String?`
- `common/src/domain/message/message.ts` の `MessageRecordSchema` に同フィールドを optional で追加
- `MessageRepository` インターフェースに:
  - `createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord>`
  - `updateIssueRef(id: string, issueNumber: number, issueUrl: string): Promise<MessageRecord | null>`
- InMemoryMessageRepository / PrismaMessageRepository に実装

### UX 提案バッチ（planningBatch.ts）
- 依存: `{ messageRepository, channelRepository, appSettingRepository? }` と env `ANTHROPIC_API_KEY`
- 巡回 URL: `CLIENT_URL` env（デフォルト `http://localhost:5173`）+ 既知パス一覧
- fetch でページ HTML を取得 → cheerio でテキスト抽出 → Claude API (claude-haiku-4-5) で提案生成
- 1 バッチで最大 3 提案を 企画 チャンネルへ保存
- `ANTHROPIC_API_KEY` 未設定 → スキップ・エラーログのみ
- `企画` チャンネルが DB に無ければ API でスキップ（バッチ落とさない）

### Issue 起票 API
- `POST /channels/:channelId/messages/:messageId/create-issue`
- `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` env から @octokit/rest で issue 作成
- Issue タイトル: `[UX提案] {proposalTitle}`
- Issue ボディ: `{proposalReason}\n\n**対象画面**: {proposalTargetUrl}\n\n_AI が 企画 チャンネルから自動起票_`
- ラベル: `["df:todo"]`（ラベルが存在しなければ起票は行うがラベル付与はスキップ）
- 起票後: `updateIssueRef` でメッセージを更新し、`{ issueNumber, issueUrl }` を返す

### app.ts への組み込み
- `createPlanningIssuesRouter(messageRepository)` を追加
- マウントパス: `/channels`（channels ルータと重複するため別ルータで `/channels/:channelId/messages/:messageId/create-issue` を追加）

## 5. 影響範囲

| ワークスペース | 変更概要 |
|---|---|
| `common` | ChannelTypeSchema, MessageRecordSchema, DEFAULT_CHANNELS, CHANNEL_IDS |
| `server` | Prisma schema + migration, MessageRepository + 実装, planningBatch, planning-issues route, app.ts, seedDevData |

## 6. テスト計画（TDDで書くテスト一覧）

### common テスト
- `ChannelTypeSchema` が `"planning"` を受け付ける
- `DEFAULT_CHANNELS` に kikaku エントリが含まれる
- `MessageRecordSchema` が proposalTitle 等の optional フィールドを持つ

### server/batch/planningBatch.test.ts
- `ANTHROPIC_API_KEY` 未設定時にスキップする
- fetch モックで HTML を取得し、Claude API モックで提案を生成して保存する
- `企画` チャンネルが存在しなければメッセージ保存をスキップする

### server/routes/planning-issues.test.ts
- `GITHUB_TOKEN` 未設定時に 500 を返す
- 存在しないメッセージ ID で 404 を返す
- 正常ケースで 201 + issueNumber を返す
- メッセージの issueNumber / issueUrl が更新される

## 7. リスク・未決事項

- `cheerio` を使った HTML パース: ページが SPA（React）の場合、サーバサイドレンダリングなしでは意味のある DOM が取れない可能性がある。MVP では静的コンテンツ（ページタイトル・ナビゲーション等）のみを対象とし、JS 評価は不要と割り切る。
- `df:todo` ラベルが GitHub リポジトリに存在しない場合: Issue 起票は行い、ラベル付与はスキップ（エラーで全体を落とさない）。
- `GITHUB_OWNER` / `GITHUB_REPO` が未設定の場合: `/create-issue` は 500 を返し、環境変数の設定を促すメッセージを返す。
