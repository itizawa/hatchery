/**
 * 定時バッチ用の薄い構造化ログヘルパ（#470）。
 *
 * バッチは長時間・無人実行（Cloud Run Jobs）で動くため、ログのパース・集約しやすさが運用に直結する。
 * HTTP 側の `middleware/requestLogger.ts` に対応するバッチ側の共通ログ抽象として、
 * `event` 名 + 任意の構造化フィールドを **1 行 JSON** で出力し、形式・ペイロードを統一する。
 *
 * - `level` は info / error の 2 値（元の `console.warn` は致命的でない情報出力として info に寄せ、
 *   意味は `event` 名で表現する）。
 * - info は標準出力（`console.log`）、error は標準エラー（`console.error`）へ分けて出す。
 * - 外部ログ基盤（Cloud Logging の構造化フィールド等）への送出設計は本 Issue のスコープ外。
 */

/** 構造化ログに付与する任意フィールド。 */
export type BatchLogFields = Record<string, unknown>;

/** ヘルパが管理する予約キー。fields でこれらを渡してもヘルパ側の値を優先する。 */
const RESERVED_KEYS = ["level", "event", "error"] as const;

/** fields から予約キーを除いたコピーを返す（ヘルパ側フィールドの上書きを防ぐ）。 */
function sanitizeFields(fields: BatchLogFields | undefined): BatchLogFields {
  if (!fields) return {};
  const copy: BatchLogFields = { ...fields };
  for (const key of RESERVED_KEYS) {
    delete copy[key];
  }
  return copy;
}

/**
 * unknown なエラー値からメッセージ文字列を抽出する（#470 AC3）。
 * `err instanceof Error ? err.message : String(err)` の重複を 1 箇所に集約する。
 */
export function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * info レベルの構造化ログを 1 行 JSON で標準出力に出す（#470 AC1）。
 * @param event ドット区切りの event 名（例 "community_batch.completed"）。
 * @param fields 任意の構造化フィールド。
 */
export function logBatchInfo(event: string, fields?: BatchLogFields): void {
  const payload = { level: "info", event, ...sanitizeFields(fields) };
  console.log(JSON.stringify(payload));
}

/**
 * error レベルの構造化ログを 1 行 JSON で標準エラーに出す（#470 AC1 / AC3）。
 * `err` からのメッセージ抽出は extractErrorMessage に集約し `error` フィールドに入れる。
 * @param event ドット区切りの event 名（例 "community_batch.community_failed"）。
 * @param err 失敗の原因（Error / 非 Error いずれも可）。
 * @param fields 任意の構造化フィールド。
 */
export function logBatchError(event: string, err: unknown, fields?: BatchLogFields): void {
  const payload = {
    level: "error",
    event,
    error: extractErrorMessage(err),
    ...sanitizeFields(fields),
  };
  console.error(JSON.stringify(payload));
}
