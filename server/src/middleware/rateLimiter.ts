import type { RequestHandler } from "express";

/** レート制限の設定。store はインメモリ固定ウィンドウ（単一プロセス前提・MVP）。 */
export interface RateLimiterOptions {
  /** ウィンドウ長（ミリ秒）。この期間あたり max 件まで許可する。 */
  windowMs: number;
  /** ウィンドウ内に許可する最大リクエスト数（IP ごと）。 */
  max: number;
  /** 現在時刻（ミリ秒）。テストで注入できるようにする。既定は Date.now。 */
  now?: () => number;
}

interface Bucket {
  count: number;
  /** このウィンドウが満了する時刻（ミリ秒）。 */
  resetAt: number;
}

/**
 * IP ベースの固定ウィンドウ・レート制限ミドルウェアを生成する。
 * ウィンドウ内 max 件までは next()、超過は 429 と { error: "TooManyRequests" } を返す。
 * 新規ウィンドウ作成時に期限切れバケットを掃除し、IP が増えてもメモリが肥大しないようにする。
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const { windowMs, max, now = () => Date.now() } = options;
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const ts = now();
    const bucket = buckets.get(key);

    if (!bucket || ts >= bucket.resetAt) {
      sweepExpired(buckets, ts);
      buckets.set(key, { count: 1, resetAt: ts + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      // 上限到達。カウンタはこれ以上増やさない（フラッド時の無意味な増加を避ける）。
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - ts) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "TooManyRequests" });
      return;
    }
    bucket.count += 1;
    next();
  };
}

/** 期限切れのバケットを削除する（メモリ肥大の防止）。 */
function sweepExpired(buckets: Map<string, Bucket>, ts: number): void {
  for (const [key, bucket] of buckets) {
    if (ts >= bucket.resetAt) buckets.delete(key);
  }
}
