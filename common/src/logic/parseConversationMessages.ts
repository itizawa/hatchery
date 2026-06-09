import { MessageSchema, type Message } from "../domain/message/index.js";

/** raw 文字列から JSON 配列を抽出してパースする。抽出できなければ例外を投げる。 */
const extractJsonArray = (rawText: string): unknown[] => {
  const tryParse = (text: string): unknown[] | null => {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  // 1. まずはそのまま JSON 配列としてパースを試みる。
  const direct = tryParse(rawText.trim());
  if (direct) return direct;

  // 2. コードフェンスや説明文が混ざる場合に備え、最初の '[' から最後の ']' までを抽出して再試行する。
  const start = rawText.indexOf("[");
  const end = rawText.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = tryParse(rawText.slice(start, end + 1));
    if (sliced) return sliced;
  }

  throw new Error("会話生成レスポンスから JSON 配列を抽出できませんでした");
};

/**
 * Claude が生成した会話 JSON をパースし、検証済みの Message[] に変換する（#53・純粋関数）。
 * - JSON 配列でない／抽出できない場合は例外を投げる（呼び出し側でログ・スキップする）。
 * - 各項目を MessageSchema で検証し、channel を引数の channelId で注入する。
 * - createdEmployeeId が knownSpeakerIds に無い項目、空 text・上限超過 text などの不正項目は除外する（#222）。
 */
export const parseConversationMessages = (
  rawText: string,
  channelId: string,
  knownSpeakerIds: readonly string[],
): Message[] => {
  const items = extractJsonArray(rawText);
  const known = new Set(knownSpeakerIds);

  const messages: Message[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { createdEmployeeId, text } = item as { createdEmployeeId?: unknown; text?: unknown };
    const parsed = MessageSchema.safeParse({ createdEmployeeId, channel: channelId, text });
    if (parsed.success && known.has(parsed.data.createdEmployeeId)) {
      messages.push(parsed.data);
    }
  }
  return messages;
};
