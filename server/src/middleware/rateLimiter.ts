import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

/**
 * IP ベースのレート制限ミドルウェアを生成する（express-rate-limit ラッパー）。
 * ウィンドウ内 max 件まで通過し、超過は 429 + { error: "TooManyRequests" } + Retry-After を返す。
 * マルチプロセス対応が必要になった際は store オプションで Redis 等に差し替え可能。
 */
export function createRateLimiter({ windowMs, max }: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "TooManyRequests" });
    },
  });
}
