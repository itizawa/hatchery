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
