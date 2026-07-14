/**
 * HTTP（API サーバ）側の構造化ログヘルパ（#865）。
 *
 * Cloud Run（Cloud Logging）で jsonPayload として認識される 1 行 JSON を出力する。
 * `severity` フィールドにより Cloud Logging の重大度フィルタ・アラートが機能する。
 *
 * batch/logger.ts（#470）とは意図的に別モジュール。HTTP 側は stack trace を保持し、
 * バッチ側は err.message のみ（設計書 docs/design/issue-865.md §4 参照）。
 */

export type LogFields = Record<string, unknown>;

const RESERVED_KEYS = ["level", "severity", "event", "error", "stack"] as const;

function sanitizeFields(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  const copy: LogFields = { ...fields };
  for (const key of RESERVED_KEYS) {
    delete copy[key];
  }
  return copy;
}

export function extractErrorInfo(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

export function logInfo({ event, fields }: { event: string; fields?: LogFields }): void {
  const payload = { severity: "INFO", level: "info", event, ...sanitizeFields(fields) };
  console.log(JSON.stringify(payload));
}

export function logError({
  event,
  err,
  fields,
}: {
  event: string;
  err: unknown;
  fields?: LogFields;
}): void {
  const { message, stack } = extractErrorInfo(err);
  const payload = {
    severity: "ERROR",
    level: "error",
    event,
    error: message,
    ...(stack != null ? { stack } : {}),
    ...sanitizeFields(fields),
  };
  console.error(JSON.stringify(payload));
}
