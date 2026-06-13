/**
 * API 呼び出し失敗（mutation reject）から、ユーザーに提示するエラーメッセージを取り出す（#476）。
 *
 * サーバ（`server/src/middleware/errorHandler.ts`）はエラーを `{ error: string }` 形のボディで返す。
 * client の API ヘルパはそれを `Error.message` に乗せて throw するが、openapi-fetch の生 error
 * オブジェクト（`{ error: string }`）が直接渡るケースにも備えて両形を扱う。
 *
 * @param error mutation/Promise の reject 値（unknown）
 * @param fallback 抽出できないときに表示する既定文言
 * @returns ユーザー向けエラーメッセージ
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "保存に失敗しました。時間をおいて再度お試しください。",
): string {
  if (error instanceof Error) {
    const msg = error.message.trim();
    return msg.length > 0 ? msg : fallback;
  }
  // openapi-fetch は非 2xx 時にパース済みボディを `error` として返す。サーバは `{ error: string }`。
  if (error !== null && typeof error === "object" && "error" in error) {
    const inner = (error as { error: unknown }).error;
    if (typeof inner === "string" && inner.trim().length > 0) {
      return inner.trim();
    }
  }
  return fallback;
}

/**
 * openapi-fetch のエラー応答（非 2xx）から `Error` に乗せる文言を組み立てる（#476）。
 *
 * サーバは `{ error: string }` をボディで返すため、それがあれば採用する。
 * 無ければ HTTP ステータスを付したフォールバック文言を返す。API ヘルパが
 * `throw new Error(buildApiErrorMessage(...))` する用途。
 *
 * @param errorBody openapi-fetch が返すパース済みエラーボディ（`error` フィールド・undefined もあり得る）
 * @param status HTTP ステータスコード
 * @param fallback ボディに `error` が無いときの基底文言
 */
export function buildApiErrorMessage(
  errorBody: unknown,
  status: number,
  fallback: string,
): string {
  if (
    errorBody !== null &&
    typeof errorBody === "object" &&
    "error" in errorBody &&
    typeof (errorBody as { error: unknown }).error === "string" &&
    (errorBody as { error: string }).error.trim().length > 0
  ) {
    return (errorBody as { error: string }).error.trim();
  }
  return `${fallback} (${status})`;
}
