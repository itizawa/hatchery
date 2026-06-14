import type { Request, RequestHandler } from "express";

import {
  CACHE_DEFAULTS,
  buildPrivateCacheControl,
  buildPublicCacheControl,
  type PublicCacheControlOptions,
} from "../config/security.js";

/**
 * リクエストが認証済みかを判定する（#559 AC4）。
 * passport セッション（req.isAuthenticated / req.user）の有無で判断する。
 * いずれかが立っていれば「ユーザー個別の応答になりうる」とみなし安全側（public 禁止）に倒す。
 */
function isAuthenticatedRequest(req: Request): boolean {
  const maybeAuth = req as Request & { isAuthenticated?: () => boolean };
  if (typeof maybeAuth.isAuthenticated === "function" && maybeAuth.isAuthenticated()) {
    return true;
  }
  return req.user != null;
}

/**
 * 公開・コンテンツのみの GET にエッジ/ブラウザキャッシュ用 Cache-Control を付与するミドルウェア（#559 AC2/AC4/AC6）。
 * - 未認証 かつ GET のときのみ `public, s-maxage, stale-while-revalidate` を付与する。
 * - 認証済み（ユーザー個別の応答になりうる）/ 非 GET（書き込み系）には `private, no-store` を付与して
 *   共有キャッシュへの保存を確実に禁止する（安全側の既定）。
 * - `Vary: Cookie` を併せて付け、エッジ/ブラウザが Cookie 有無でキャッシュエントリを分離するよう促す（多層防御）。
 * キャッシュ方針（秒数・文字列）は config/security.ts に一元化し、ここはそれを応答に適用するだけに留める。
 */
export function createPublicCache(
  options: PublicCacheControlOptions = CACHE_DEFAULTS,
): RequestHandler {
  const publicValue = buildPublicCacheControl(options);
  const privateValue = buildPrivateCacheControl();
  return (req, res, next) => {
    res.vary("Cookie");
    if (req.method === "GET" && !isAuthenticatedRequest(req)) {
      res.setHeader("Cache-Control", publicValue);
    } else {
      res.setHeader("Cache-Control", privateValue);
    }
    next();
  };
}

/**
 * 公開キャッシュ不可なルート（認証系・管理系・ユーザー個別）に常に `private, no-store` を付与する（#559 AC3）。
 * リクエストの認証有無やメソッドに関わらず共有キャッシュへの保存を禁止する。
 */
export function createNoStoreCache(): RequestHandler {
  const value = buildPrivateCacheControl();
  return (_req, res, next) => {
    res.setHeader("Cache-Control", value);
    next();
  };
}
