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
 * リクエスト受信から ms を超えても応答が始まらなければ 503 と { error: "RequestTimeout" } を返す。
 * 実時間タイマー（res.setTimeout のソケットアイドルではなく）で処理時間を測り、応答完了
 * （finish）や接続切断（close）でクリアして keep-alive 越しのタイマー漏れを防ぐ。
 * 遅いリクエストでコネクションが占有され続けるのを防ぐ。
 */
export function createRequestTimeout(ms: number): RequestHandler {
  return (_req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: "RequestTimeout" });
      }
    }, ms);
    // タイマーがイベントループを生かし続けないようにする（プロセス終了を妨げない）。
    timer.unref();
    const clear = (): void => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
