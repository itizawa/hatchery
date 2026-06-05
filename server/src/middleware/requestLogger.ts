import morgan from "morgan";
import type { RequestHandler } from "express";
import type { StreamOptions } from "morgan";

/**
 * リクエストログミドルウェアを生成する（#97）。
 * - dev 環境: `dev` フォーマット（色付き・メソッド/パス/ステータス/レスポンスタイム）
 * - production: `combined` フォーマット（Apache 互換・機械解析しやすい）
 * - test かつ stream 未指定: no-op（テストのノイズを避ける）
 * stream を渡すとテストでログ出力先をキャプチャできる。
 */
export function createRequestLogger(stream?: StreamOptions): RequestHandler {
  if (process.env.NODE_ENV === "test" && !stream) {
    return (_req, _res, next) => next();
  }
  const format = process.env.NODE_ENV === "production" ? "combined" : "dev";
  return morgan(format, stream ? { stream } : undefined);
}
