import Anthropic from "@anthropic-ai/sdk";

/**
 * チャンネル会話を生成する関数（#53）。プロンプトと API キーを受け、モデルの生テキストを返す。
 * テストではスタブを注入し、本番は Claude を使う（planningBatch.ts と同じ注入パターン）。
 */
export type ConversationGenerator = (prompt: string, apiKey: string) => Promise<string>;

/** チャンネルのあらすじを生成する関数（#53）。 */
export type SummaryGenerator = (prompt: string, apiKey: string) => Promise<string>;

/** 会話・あらすじ生成に使う Claude モデル（#53）。 */
const MODEL = "claude-sonnet-4-6";

/** Claude にプロンプトを投げ、最初のテキストブロックを返す共通処理。 */
async function callClaudeText(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const textContent = message.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

/** Claude で会話 JSON を生成する既定実装（#53）。 */
export const generateConversationWithClaude: ConversationGenerator = (prompt, apiKey) =>
  callClaudeText(prompt, apiKey, 1024);

/** Claude であらすじを生成する既定実装（#53）。 */
export const generateSummaryWithClaude: SummaryGenerator = (prompt, apiKey) =>
  callClaudeText(prompt, apiKey, 512);
