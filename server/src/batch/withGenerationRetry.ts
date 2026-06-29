import { logBatchError, logBatchInfo } from "./logger.js";

/** JSON パース・スキーマ検証・author 検証の失敗を表すリトライ可能エラー（#626）。 */
export class RetryableGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableGenerationError";
  }
}

/**
 * `fn` を最大 `maxRetries` 回リトライする（#626）。
 * `RetryableGenerationError` のみをリトライ対象とし、その他のエラーは即 throw する。
 * バックオフなし（JSON パース失敗は即再試行で十分）。
 */
export async function withGenerationRetry<T>({
  fn,
  maxRetries,
  label,
}: {
  fn: () => Promise<T>;
  maxRetries: number;
  label: string;
}): Promise<T> {
  let lastError: RetryableGenerationError | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      logBatchInfo("generation.retry", { label, attempt, maxRetries });
    }
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RetryableGenerationError) {
        lastError = err;
        if (attempt < maxRetries) {
          logBatchError("generation.retry_failed", err, { label, attempt, maxRetries });
        }
        continue;
      }
      throw err;
    }
  }
  throw lastError!;
}
