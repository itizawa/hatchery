import type { ErrorRequestHandler } from "express";

/**
 * 集約エラーハンドラ。
 * body-parser が投げる過大ペイロードエラー（status 413 / type "entity.too.large"）は
 * 413 PayloadTooLarge に変換する。それ以外のユースケース/永続化の例外は 500 に変換する。
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // 既に応答が始まっている場合（例: タイムアウトで 503 送出後に遅延ハンドラが next(err)）は
  // 二重送信で ERR_HTTP_HEADERS_SENT を投げないよう Express 既定のハンドラへ委譲する。
  if (res.headersSent) {
    next(err);
    return;
  }
  const e = err as { status?: number; statusCode?: number; type?: string } | null;
  if (e?.status === 413 || e?.statusCode === 413 || e?.type === "entity.too.large") {
    res.status(413).json({ error: "PayloadTooLarge" });
    return;
  }
  res.status(500).json({ error: "InternalServerError" });
};
