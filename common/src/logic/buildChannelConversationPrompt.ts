import { MAX_MESSAGE_LENGTH } from "../domain/message/index.js";

/** プロンプトに載せる社員ロスターの 1 要素（#53）。 */
export interface ConversationPromptEmployee {
  id: string;
  displayName: string;
  role?: string | null;
  personality?: string | null;
}

/** buildChannelConversationPrompt の入力（#53）。 */
export interface BuildChannelConversationPromptInput {
  /** チャンネルの表示名（例: 雑談）。 */
  channelLabel: string;
  /** 発言候補の社員ロスター（id / displayName / role / personality）。 */
  employees: readonly ConversationPromptEmployee[];
  /** 直近ログ（formatRecentLog の出力想定。新しい順ではなく時系列昇順の行配列）。 */
  recentLog: readonly string[];
  /** それ以前の文脈を圧縮したあらすじ。無ければ null。 */
  summary?: string | null;
  /** 1 発言の最大文字数（既定 MAX_MESSAGE_LENGTH）。 */
  maxMessageLength?: number;
}

/**
 * チャンネルの AI 会話を 1 API コールで生成させるためのプロンプトを組み立てる（#53・純粋関数）。
 * concept.md「1 コールで複数 message（複数社員の掛け合い）」に従い、JSON 配列での出力を指示する。
 * Anthropic SDK 等の実行環境依存は持たない（common の純粋ロジック・ADR-0005）。
 */
export const buildChannelConversationPrompt = (
  input: BuildChannelConversationPromptInput,
): string => {
  const maxLen = input.maxMessageLength ?? MAX_MESSAGE_LENGTH;

  const roster = input.employees
    .map((e) => {
      const role = e.role ? `・役割: ${e.role}` : "";
      const personality = e.personality ? `・性格: ${e.personality}` : "";
      return `- ${e.id}（表示名: ${e.displayName}${role}${personality}）`;
    })
    .join("\n");

  const summaryBlock = input.summary
    ? `これまでのあらすじ:\n${input.summary}\n\n`
    : "";

  const recentBlock =
    input.recentLog.length > 0
      ? `直近の会話ログ:\n${input.recentLog.join("\n")}\n\n`
      : "直近の会話ログ: （まだありません）\n\n";

  return `あなたは観察エンタメ「Hatchery」の脚本家です。「#${input.channelLabel}」チャンネルで働く AI 社員たちの、ほのぼのとした掛け合いの会話を生成してください。

登場する社員（speaker には必ず下記の id を使うこと）:
${roster}

${summaryBlock}${recentBlock}指示:
- 1 回の応答で、複数の社員による複数の発言（掛け合い）を生成すること。
- 各社員の役割・性格に沿った口調で、深刻にならずほのぼのとした内容にすること。
- speaker には上記ロスターの id だけを使うこと（表示名やそれ以外の id は使わない）。
- 各 text は ${maxLen} 文字以内にすること。
- 出力は次の JSON 配列形式のみとし、それ以外のテキスト（説明・コードフェンス等）は一切含めないこと:
[
  { "speaker": "<社員のid>", "text": "<発言内容>" }
]`;
};
