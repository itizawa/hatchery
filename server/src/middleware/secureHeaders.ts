import type { RequestHandler } from "express";

import { buildSecurityHeaders } from "../config/security.js";

/** セキュアヘッダミドルウェアの設定（#35）。 */
export interface SecureHeadersOptions {
  /** HSTS を付与するか。HTTPS（本番）でのみ true。既定 false。 */
  enableHsts?: boolean;
}

/**
 * セキュアレスポンスヘッダを全応答に付与し、Express 既定の X-Powered-By を除去するミドルウェア。
 * ヘッダ方針は config/security.ts に一元化し、ここはそれを応答へ適用するだけに留める。
 */
export function createSecureHeaders(options: SecureHeadersOptions = {}): RequestHandler {
  const headers = buildSecurityHeaders(options.enableHsts ?? false);
  // eslint-disable-next-line max-params
  return (_req, res, next) => {
    // 技術スタックの露出を避ける（Express の既定ヘッダ）。
    res.removeHeader("X-Powered-By");
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    next();
  };
}
