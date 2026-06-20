import type { RequestHandler } from "express";

import { CORS_DEFAULTS } from "../config/security.js";

/** CORS ミドルウェアの設定（#35）。 */
export interface CorsOptions {
  /**
   * 許可するオリジンのリスト。完全一致で判定する。
   * `"*"` を含めると任意オリジンを許可する（資格情報併用のためワイルドカードではなく反映方式）。
   */
  allowedOrigins: string[];
}

/** origin が許可リストに含まれるか（`*` は任意許可）。 */
// eslint-disable-next-line max-params
function isAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

/**
 * オリジン許可リスト方式の CORS ミドルウェアを生成する（外部依存なし＝#34 と同方針）。
 * - 許可オリジン: Access-Control-Allow-Origin にそのオリジンを反映 + Allow-Credentials + Vary: Origin。
 *   ワイルドカード `*` と資格情報は併用不可のため、常に具体オリジンを反映する。
 * - プリフライト（OPTIONS かつ Access-Control-Request-Method あり）: Allow-Methods/Headers/Max-Age を付け 204 で打ち切る。
 * - 不許可オリジン / Origin 無し: CORS ヘッダを付けず後続へ流す（ブラウザ側で遮断される）。
 */
export function createCors(options: CorsOptions): RequestHandler {
  const { allowedOrigins } = options;
  // eslint-disable-next-line max-params
  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = typeof origin === "string" && isAllowed(origin, allowedOrigins);

    // 応答がオリジンに依存することをキャッシュへ常に知らせ、オリジン跨ぎのキャッシュ汚染を防ぐ。
    res.vary("Origin");

    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // プリフライトは本リクエストの前にブラウザが送る OPTIONS。許可オリジンのみ詳細を返し 204 で打ち切る。
    const isPreflight = req.method === "OPTIONS" && req.headers["access-control-request-method"];
    if (isPreflight) {
      if (allowed) {
        res.setHeader("Access-Control-Allow-Methods", CORS_DEFAULTS.methods.join(", "));
        res.setHeader("Access-Control-Allow-Headers", CORS_DEFAULTS.allowedHeaders.join(", "));
        res.setHeader("Access-Control-Max-Age", String(CORS_DEFAULTS.maxAgeSeconds));
      }
      res.status(204).end();
      return;
    }

    next();
  };
}
