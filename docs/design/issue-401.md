# 設計書: 定時バッチの会話生成 max_tokens 不足修正 (#401)

## 1. 目的 / 背景

定時バッチ（`pnpm --filter @hatchery/server batch`）実行時、`generateConversationWithClaude` の `max_tokens` が 1024 に固定されているため、複数 post + comment の日本語 JSON 出力が切り詰められ `JSON.parse` に失敗、全 community がスキップされる問題を修正する。

また `stop_reason` を見ていないため切り詰め発生時に原因がログで判別できない問題も合わせて解消する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `generateConversationWithClaude` の `max_tokens` を 1024 → 8192 に引き上げる
- API レスポンスの `stop_reason === "max_tokens"` 時に `console.warn` で警告ログを出力する
- `stop_reason === "max_tokens"` でも処理はスローせず、テキストをそのまま返す（既存のスキップロジックに委ねる）
- `aiMessageGenerator.ts` の単体テスト `aiMessageGenerator.test.ts` を新規追加（TDD）

**やらないこと:**
- `generateSummaryWithClaude` の max_tokens 変更（スコープ外）
- パース失敗時の自動リトライ
- structured outputs / tool use による JSON 強制
- max_tokens の AppSetting 化（#389 スコープ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateConversationWithClaude` が内部で `max_tokens: 8192`（または 4096 以上）で `messages.create` を呼ぶ
2. Anthropic SDK が `stop_reason: "max_tokens"` を返すとき、`console.warn` が呼ばれる（コミュニティ特定につながる情報を含む）
3. Anthropic SDK が `stop_reason: "end_turn"` を返すとき、`console.warn` は呼ばれない
4. `stop_reason === "max_tokens"` でも関数はスローせずテキストを返す
5. `generateSummaryWithClaude` は引き続き `max_tokens: 512` のまま
6. 既存の `runCommunityBatch.test.ts` が引き続き緑

## 4. 設計方針

### 修正箇所: `server/src/batch/aiMessageGenerator.ts`

`callClaudeText` 内で `message.stop_reason` を確認し、`"max_tokens"` の場合は `console.warn` を呼ぶ。
「community 特定につながる情報」としてプロンプトの先頭 100 文字を警告メッセージに含める。
（プロンプトには community 名・description が含まれているため community 特定が可能）

```typescript
if (message.stop_reason === "max_tokens") {
  console.warn(
    `[aiMessageGenerator] 出力が max_tokens (${maxTokens}) で切り詰められました。` +
    `プロンプト先頭: "${prompt.slice(0, 100)}..."`
  );
}
```

### テスト方針

`vi.mock("@anthropic-ai/sdk")` で Anthropic SDK をモックし、`messages.create` の戻り値に `stop_reason` を制御する。

## 5. 影響範囲

- **変更対象**: `server/src/batch/aiMessageGenerator.ts`（修正）
- **新規追加**: `server/src/batch/aiMessageGenerator.test.ts`
- **変更なし**: `runCommunityBatch.ts`・`buildCommunityPrompt.ts`・共通の `ConversationGenerator` 型

## 6. テスト計画

| テスト | 内容 |
|--------|------|
| max_tokens 確認 | `messages.create` が `max_tokens: 8192` 以上で呼ばれることを検証 |
| stop_reason=max_tokens で warn | `console.warn` が呼ばれることを検証 |
| stop_reason=end_turn で warn なし | `console.warn` が呼ばれないことを検証 |
| スローしない | `stop_reason=max_tokens` でもテキストが返ることを検証 |
| summary は 512 のまま | `generateSummaryWithClaude` が `max_tokens: 512` で呼ばれることを検証 |

## 7. リスク・未決事項

- `max_tokens: 8192` に引き上げると Claude API のコストが増加する可能性があるが、正常動作が最優先。コスト削減は #389 で別途対応。
- `stop_reason` の型は `@anthropic-ai/sdk` の `Message.stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null`。
