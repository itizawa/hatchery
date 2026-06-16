/**
 * 定時キー生成（#597）。
 *
 * 現在時刻（または指定した日時）から slot_key を生成する純粋関数。
 * "YYYY-MM-DDTHH:MM" 形式・UTC 基準。Cron 二重発火ガードに使う。
 * 実行環境のタイムゾーンに依存しない。
 */

/**
 * 日時から slot_key を生成する（"YYYY-MM-DDTHH:MM" 形式・UTC 基準）。
 *
 * @param now 基準日時。省略時は実行時の `new Date()`。
 * @returns "YYYY-MM-DDTHH:MM" 形式の定時キー文字列。
 */
export function generateSlotKey(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hour = pad(now.getUTCHours());
  const minute = pad(now.getUTCMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
