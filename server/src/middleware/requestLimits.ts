import express, { type RequestHandler } from "express";

/**
 * ボディサイズ制限つきの JSON ボディパーサを生成する。
 * 上限超過時、express.json は PayloadTooLargeError（status 413）を next(err) に渡すため、
 * errorHandler が 413 に変換する（過大ペイロードによる過負荷を防ぐ）。
 */
export function createJsonBodyParser(limit: string): RequestHandler {
  return express.json({ limit });
}

/**
 * リクエストタイムアウトミドルウェアを生成する。
 * 処理が ms を超えた場合に 503 と { error: "RequestTimeout" } を返す（応答済みなら何もしない）。
 * 遅いリクエストでコネクションが占有され続けるのを防ぐ。
 */
export function createRequestTimeout(ms: number): RequestHandler {
  return (_req, res, next) => {
    res.setTimeout(ms, () => {
      if (!res.headersSent) {
        res.status(503).json({ error: "RequestTimeout" });
      }
    });
    next();
  };
}
