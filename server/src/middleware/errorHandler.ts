import type { ErrorRequestHandler } from "express";

/** 集約エラーハンドラ。ユースケース/永続化で投げられた例外を 500 に変換する。 */
export const errorHandler: ErrorRequestHandler = (
  _err,
  _req,
  res,
  // Express はエラーハンドラを引数 4 個（arity 4）で識別するため _next を省略できない。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next,
) => {
  res.status(500).json({ error: "InternalServerError" });
};
