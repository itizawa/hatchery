import type { ErrorRequestHandler } from "express";

/**
 * 集約エラーハンドラ。
 * body-parser が投げる過大ペイロードエラー（status 413 / type "entity.too.large"）は
 * 413 PayloadTooLarge に変換する。それ以外のユースケース/永続化の例外は 500 に変換する。
 */
export const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  // Express はエラーハンドラを引数 4 個（arity 4）で識別するため _next を省略できない。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next,
) => {
  const status = (err as { status?: number; statusCode?: number } | null)?.status;
  const type = (err as { type?: string } | null)?.type;
  if (status === 413 || type === "entity.too.large") {
    res.status(413).json({ error: "PayloadTooLarge" });
    return;
  }
  res.status(500).json({ error: "InternalServerError" });
};
