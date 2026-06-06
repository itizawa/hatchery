# 設計書: AIを使用してチャンネルにメッセージを投稿する (#53)

## 1. 目的 / 背景

定時 cron バッチで Claude API を呼び出し、`zatsudan` タイプのチャンネルに所属する AI 社員（`isBot=true`）の掛け合いメッセージを自動生成・投稿する。1 API コールで複数社員の複数発言を JSON 配列として生成し、DB に永続化する。Hatchery の中核体験「AI 社員の会話を観察する」を実現する。

依存 Issue（#33 チャンネル所属 / #49 isBot / #52 API キー基盤 / #54 チャンネルタイプ）はすべて closed 済み。本 Issue でそれらの基盤を結線し、スタブ（`stubMessageGenerator`）を AI 生成に置き換える。

> 補足: 別 Issue #183 は「ユーザー投稿をトリガにした即時生成 + `postedAt` 予約表示」という別アプローチ。本 #53 は **定時方式（cron バッチ）** であり、`createdAt` + あらすじ summary を文脈に使う。両者は併存する。

## 2. スコープ（やること / やらないこと）

### やること
- `Channel` に `summary`（nullable）・`summaryUpdatedAt`（nullable）を追加（マイグレーション）。
- Claude（`claude-sonnet-4-6`）で `zatsudan` チャンネルの会話を 1 API コールで生成し、DB へ保存する定時バッチ。
- プロンプト文脈: 直近 30 件メッセージ（`createdAt` 降順取得）＋ それ以前は channel summary。社員の `displayName` / `role` / `personality` を含める。
- あらすじ更新バッチ: 1 日 1 回、当日作成メッセージを要約して `summary` を更新（会話生成バッチと別スケジュール）。
- 生成 JSON を Zod（`MessageSchema`）で検証し、未知 speaker・不正項目を除外。
- エラーハンドリング: API キー未設定→スキップ＋ログ。API 失敗→リトライせずログを残し次チャンネルへ。
- 実行頻度の設定: `BATCH_SCHEDULE` 環境変数から定時（時）を解決、**最大 1 日 4 回**に制限する純粋関数。

### やらないこと（スコープ外）
- `postedAt` 予約表示（#183）。本 Issue は `createdAt` ベース。
- 生成トークン使用量の記録（#153）。
- プロンプトのキャラクター性高度化・リトライ／レート制御の作り込み。
- `task` / `planning` チャンネルへの会話生成（対象は `zatsudan` のみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `Channel` に `summary String?` / `summaryUpdatedAt DateTime?` を追加するマイグレーションが存在し、`pnpm build`（`prisma generate`）が通る。
2. **common 純粋ロジック（TDD）**:
   - `buildChannelConversationPrompt` が、社員ロスター（id/displayName/role/personality）・直近ログ・あらすじを含み、「1 応答で複数発言・JSON 配列 `[{speaker,text}]`・speaker は既知 id のみ・text は上限文字数」を指示する文字列を返す。
   - `parseConversationMessages(raw, channelId, knownSpeakerIds)` が、JSON 配列をパースし `MessageSchema` で各項目を検証、`channel` を注入、未知 speaker・不正項目を除外した `Message[]` を返す。配列でない／パース不能なら例外を投げる。コードフェンス（```json）で包まれていても抽出できる。
   - `selectMessagesForDay(messages, day)` が、`createdAt` が指定日（ローカル日）の範囲内のメッセージのみ返す。
   - `buildSummaryPrompt` が、チャンネル名・既存あらすじ・当日メッセージを含む要約指示文字列を返す。
3. **会話生成バッチ `runAiMessageBatch`（Claude をモック注入してテスト）**:
   - `zatsudan` タイプのチャンネルのみを対象にする（`task`/`planning` は対象外）。
   - 各チャンネルの所属社員のうち `isBot=true` のみを発言候補（speaker 候補）にする。
   - 注入された生成関数の出力を `parseConversationMessages` で検証し、`messageRepo.createMany` で保存する。
   - API キー未設定なら何も生成せず空配列を返す（スキップ）。
   - あるチャンネルで生成関数が throw しても、リトライせずログを残して次チャンネルの処理を継続する。
4. **あらすじ更新バッチ `runSummaryBatch`（要約関数をモック注入してテスト）**:
   - 当日作成メッセージがあるチャンネルのみ要約し `channelRepo.updateSummary` を呼ぶ。当日メッセージが無いチャンネルはスキップ。
   - API キー未設定ならスキップ。要約関数が throw してもログを残して次チャンネルを継続。
5. **スケジュール設定 `resolveBatchHours`**: `BATCH_SCHEDULE`（カンマ区切りの時）をパースし、0–23 の範囲・**最大 4 件**に制限する。未設定／不正なら `DEFAULT_BATCH_HOURS`（`[9,12,15,18]`）にフォールバックする。
6. リポジトリ拡張（InMemory / Prisma 両実装）:
   - `ChannelRepository.getSummary` / `updateSummary`。
   - `EmployeeRepository.listByIds`。
   - `MessageRepository.listRecentByChannel(channelId, limit)`（`createdAt` 降順・件数制限）。
7. `pnpm turbo run build|test|lint` が緑。client→common / server→common の一方向 import 境界、common の純粋性（Express/Prisma 非依存）を守る。Zod `.max()` 規約（`MessageSchema` の `text` は `MAX_MESSAGE_LENGTH`）を維持。

## 4. 設計方針

### レイヤと依存方向
- **純粋ロジックは common**（`buildChannelConversationPrompt` / `parseConversationMessages` / `selectMessagesForDay` / `buildSummaryPrompt`）。Express/Prisma/Anthropic SDK に非依存。UI/DB なしで高速に TDD。
- **Claude 呼び出し・DB アクセスは server**。`planningBatch.ts` の「注入可能な生成関数（既定 = Claude、テスト = スタブ）」パターンを踏襲。
- バッチは Express を一切 import しない（ADR-0004 / ADR-0009）。

### データ構造
- `Channel.summary` / `summaryUpdatedAt` は API（OpenAPI）には公開しない**バッチ内部の文脈**。common の `ChannelSchema`（API DTO）は変更せず、`ChannelRepository` に summary 専用メソッドを追加する。
- 生成メッセージは既存 `Message`（`speaker`/`channel`/`text`/`order`/`createdAt`）に保存。`order` はバッチ内の発言順（`createMany` が配列 index で採番）、チャンネル横断の時系列は `createdAt` で担保（既存 `listByChannel` の order と整合）。

### 主要モジュール
- common: `logic/buildChannelConversationPrompt.ts` / `logic/parseConversationMessages.ts` / `logic/summarizeChannel.ts`（`selectMessagesForDay` + `buildSummaryPrompt`）。
- server: `batch/aiMessageGenerator.ts`（`ConversationGenerator` + Claude 既定実装）/ `batch/runAiMessageBatch.ts` / `batch/runSummaryBatch.ts` / `batch/schedule.ts` に `resolveBatchHours` 追加 / `batch/index.ts` を AI バッチへ結線 / `batch/summaryIndex.ts`（あらすじ更新エントリ）。
- persistence: `channelRepository` / `employeeRepository` / `messageRepository` の各 interface + InMemory + Prisma 実装にメソッド追加。

### エラーハンドリング方針
- API キー未設定: バッチ全体スキップ（空結果）＋ `console.error`。
- チャンネル単位の生成失敗: リトライせず `console.error` し、次チャンネルへ。
- JSON パース不能: `parseConversationMessages` が例外→バッチがチャンネル単位 catch でログして継続。

## 5. 影響範囲 / 既存への変更

- **common**: `logic/` に純粋関数 3 ファイル追加、`src/index.ts` に export 追加。
- **server**: `prisma/schema.prisma`（Channel 2 カラム）＋マイグレーション 1 件、`persistence/`（3 リポジトリに各メソッド追加・InMemory/Prisma）、`batch/`（新規 3 ファイル + schedule 拡張 + index 結線）、`package.json` に `batch:summary` スクリプト追加。
- **client / docs**: 変更なし（API スキーマ不変のため OpenAPI 再生成の差分なし）。

## 6. テスト計画（TDD で書くテスト一覧）

- common: `buildChannelConversationPrompt.test.ts` / `parseConversationMessages.test.ts` / `summarizeChannel.test.ts`。
- server: `batch/runAiMessageBatch.test.ts`（zatsudan 限定・isBot 限定・保存・キー無しスキップ・チャンネル単位失敗継続）/ `batch/runSummaryBatch.test.ts`（当日メッセージ要約・無メッセージskip・キー無しskip・失敗継続）/ `batch/schedule.test.ts` に `resolveBatchHours` ケース追加。
- persistence: `channelRepository.test.ts`（getSummary/updateSummary）/ `employeeRepository.test.ts`（listByIds）/ `messageRepository.test.ts`（listRecentByChannel）に InMemory のケース追加。Prisma 実装は既存 int テスト方針（`DATABASE_URL` 有時のみ）に合わせ必須としない。

## 7. リスク・未決事項

- 実行頻度「1 日 4 回まで」は本番では外部 cron（Cloud Run / GH Actions）で制御する前提。`resolveBatchHours` は設定の解決・上限保証を担い、実タイマー常駐はしない（既存の one-shot CLI モデルを維持）。
- Claude の応答が JSON 以外を混在させる可能性に対し、コードフェンス除去 + 配列抽出のフォールバックで頑健化するが、完全な構造化出力（tool use）への移行は将来課題。
- summary の文字数上限はプロンプト指示で誘導するのみ（保存時の機械的 truncate は将来課題）。
