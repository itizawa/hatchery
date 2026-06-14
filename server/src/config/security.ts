/**
 * セキュリティポリシーの単一情報源（#35）。
 * セキュアレスポンスヘッダと CORS の既定（メソッド・許可ヘッダ・Max-Age）をここに集約する。
 * env 変数の parse は config/env.ts に一本化し、本ファイルは「何を返すか」のポリシーだけを持つ。
 */

/** HSTS の max-age（秒）。2 年。プリロード方針は運用判断のため includeSubDomains のみ付ける。 */
const HSTS_MAX_AGE_SECONDS = 63_072_000;

/**
 * 付与すべきセキュアレスポンスヘッダの map を返す。
 * HSTS は HTTPS 前提のため、enableHsts（本番）でのみ含める（HTTP 開発環境に効かせない）。
 */
export function buildSecurityHeaders(enableHsts: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    // API サーバーはリソース取得を行わないため、すべてのソースをデフォルト禁止にする。
    "Content-Security-Policy": "default-src 'none'",
    // MIME スニッフィングを禁止し、Content-Type 偽装由来の XSS を防ぐ。
    "X-Content-Type-Options": "nosniff",
    // クリックジャッキング対策。本アプリは iframe 埋め込みを想定しないため DENY。
    "X-Frame-Options": "DENY",
    // 旧ブラウザ向けの反射型 XSS フィルタ（最新ブラウザでは無視されるが Issue 受け入れ条件に従う）。
    "X-XSS-Protection": "1; mode=block",
    // リファラ経由の情報漏えいを防ぐ。
    "Referrer-Policy": "no-referrer",
  };
  if (enableHsts) {
    headers["Strict-Transport-Security"] = `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`;
  }
  return headers;
}

/** CORS の既定ポリシー（許可メソッド・許可ヘッダ・プリフライトキャッシュ秒）。 */
export const CORS_DEFAULTS = {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAgeSeconds: 600,
} as const;

/**
 * 公開 GET レスポンスのエッジ/ブラウザキャッシュ既定値（#559・ADR-0015 / ADR-0030）。
 * - sMaxageSeconds: エッジ（Cloudflare）が再検証なしで配信する秒数。vote 反映の許容遅延（最大 60 秒）。
 * - staleWhileRevalidateSeconds: s-maxage 経過後も古い値を即返しつつバックグラウンド再検証する猶予秒数。
 * 定時方式（1 日数回更新・ADR-0030）なのでこの程度の滞留でオリジン/DB 負荷を大きく下げられる。
 * env で上書き可能（config/env.ts の CACHE_* 参照）。値を変えるときはここを単一情報源とする。
 */
export const CACHE_DEFAULTS = {
  sMaxageSeconds: 60,
  staleWhileRevalidateSeconds: 300,
} as const;

/** 公開キャッシュ秒数の指定。 */
export interface PublicCacheControlOptions {
  sMaxageSeconds: number;
  staleWhileRevalidateSeconds: number;
}

/**
 * 公開キャッシュ可能な GET 向けの Cache-Control 値を組み立てる純粋関数（#559 AC2）。
 * `public, s-maxage=<N>, stale-while-revalidate=<M>` を返す。文字列はここに一元化し各ルートに直書きしない。
 */
export function buildPublicCacheControl(options: PublicCacheControlOptions): string {
  return `public, s-maxage=${options.sMaxageSeconds}, stale-while-revalidate=${options.staleWhileRevalidateSeconds}`;
}

/**
 * 公開キャッシュ不可（ユーザー個別・認証依存・管理系・認証済みリクエスト）向けの Cache-Control 値（#559 AC3/AC4）。
 * `public` も `s-maxage` も含めず、エッジ/共有キャッシュへの保存を禁止する。
 */
export function buildPrivateCacheControl(): string {
  return "private, no-store";
}
