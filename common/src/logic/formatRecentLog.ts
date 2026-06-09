import type { Message } from "../domain/message/index.js";

/**
 * 直近ログの整形（concept.md「ユーザーメッセージ（直近ログ）」/ タイムライン整形の共通土台）。
 * messages の末尾 n 件だけを対象に、各発言を `[channel] speaker: text` の 1 行へ整形して返す。
 *
 * - messages.length <= n のときは全件を返す。n <= 0 のときは空配列。
 * - 入力配列は破壊しない（slice / map のみ・副作用なし）。
 */
export const formatRecentLog = (messages: readonly Message[], n: number): string[] => {
  if (n <= 0) return [];
  const start = Math.max(0, messages.length - n);
  return messages.slice(start).map((m) => `[${m.channel}] ${m.createdEmployeeId}: ${m.text}`);
};
