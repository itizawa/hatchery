import Anthropic from "@anthropic-ai/sdk";

/**
 * チャンネル会話を生成する関数（#53）。プロンプトと API キーを受け、モデルの生テキストを返す。
 * テストではスタブを注入し、本番は Claude を使う（依存注入パターン）。
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
  if (message.stop_reason === "max_tokens") {
    const snippet =
      prompt.length > 100 ? `"${prompt.slice(0, 100)}..."` : `"${prompt}"`;
    console.warn(
      `[aiMessageGenerator] 出力が max_tokens (${maxTokens}) で切り詰められました。プロンプト先頭: ${snippet}`,
    );
  }
  const textContent = message.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text" ? textContent.text : "";
}

/** Claude で会話 JSON を生成する既定実装（#53）。 */
export const generateConversationWithClaude: ConversationGenerator = (prompt, apiKey) =>
  callClaudeText(prompt, apiKey, 8192);

/** Claude であらすじを生成する既定実装（#53）。 */
export const generateSummaryWithClaude: SummaryGenerator = (prompt, apiKey) =>
  callClaudeText(prompt, apiKey, 512);
