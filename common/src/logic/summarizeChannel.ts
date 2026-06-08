import type { MessageRecord } from "../domain/message/index.js";

/**
 * messages のうち、createdAt が指定日（day のローカル年月日）に作成されたものだけを返す（#53・純粋関数）。
 * あらすじ更新バッチが「当日作成されたメッセージ」を要約対象に選ぶために使う。
 * 入力配列は破壊しない（filter のみ）。
 */
export const selectMessagesForDay = (
  messages: readonly MessageRecord[],
  day: Date,
): MessageRecord[] => {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return messages.filter((msg) => {
    const c = msg.createdAt;
    return c.getFullYear() === y && c.getMonth() === m && c.getDate() === d;
  });
};

/** buildSummaryPrompt の入力（#53）。 */
export interface BuildSummaryPromptInput {
  /** チャンネルの表示名。 */
  channelLabel: string;
  /** 既存のあらすじ。無ければ null。 */
  previousSummary?: string | null;
  /** 当日作成されたメッセージ（speaker / text）。speaker はプロンプト表示用の発言者ラベルで、
   * 呼び出し元が Employee.id（createdEmployeeId）または表示名を渡す（#222）。 */
  messages: readonly { speaker: string; text: string }[];
  /** あらすじの最大文字数（既定 500）。 */
  maxLength?: number;
}

/** あらすじの既定最大文字数。 */
export const DEFAULT_SUMMARY_MAX_LENGTH = 500;

/**
 * チャンネルのあらすじを更新するためのプロンプトを組み立てる（#53・純粋関数）。
 * 既存あらすじ + 当日メッセージを踏まえて、続きのあらすじを簡潔にまとめさせる。
 */
export const buildSummaryPrompt = (input: BuildSummaryPromptInput): string => {
  const maxLen = input.maxLength ?? DEFAULT_SUMMARY_MAX_LENGTH;
  const previousBlock = input.previousSummary
    ? `これまでのあらすじ:\n${input.previousSummary}\n\n`
    : "これまでのあらすじ: （まだありません）\n\n";
  const log = input.messages.map((m) => `${m.speaker}: ${m.text}`).join("\n");

  return `あなたは観察エンタメ「Hatchery」の記録係です。「#${input.channelLabel}」チャンネルのこれまでの流れを、後から会話生成の文脈に使えるよう簡潔なあらすじにまとめてください。\n\n${previousBlock}本日の会話ログ:\n${log}\n\n指示:\n- 既存のあらすじと本日の会話を踏まえ、チャンネルのこれまでの経緯を ${maxLen} 文字以内で簡潔にまとめること。\n- 登場人物の関係性や進行中の話題が分かるようにすること。\n- あらすじ本文のみを出力し、見出しや前置き・コードフェンスは含めないこと。`;
};
