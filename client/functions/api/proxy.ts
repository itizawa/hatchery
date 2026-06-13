// `/api/*` 逆プロキシ（#78）のヘルパー。onRequest を持たないため Pages のルートにはならず、
// `[[path]].ts` から import される純粋ロジック（テスト可能にするため分離）。

/** プロキシが参照する Pages ランタイム環境変数。 */
export interface ProxyEnv {
  // 転送先 Cloud Run のオリジン。未設定/空なら呼び出し側の既定値を使う。
  API_BASE_URL?: string;
}

/**
 * 転送先 Cloud Run の URL を組み立てる。リクエストの pathname（/api/...）と query を
 * そのまま API オリジンに付け替える。末尾スラッシュの重複は除去する。
 */
export function buildTargetUrl(apiBaseUrl: string, requestUrl: string): string {
  const origin = apiBaseUrl.replace(/\/+$/, "");
  const incoming = new URL(requestUrl);
  return `${origin}${incoming.pathname}${incoming.search}`;
}

/**
 * 転送先 API オリジンを解決する。`env.API_BASE_URL` を優先（末尾スラッシュ除去）、
 * 未設定/空なら fallback（dev の Cloud Run 既定オリジン）を返す。
 * 同一オリジンへフォールバックすると自己ループするため、必ず具体的なオリジンを返す。
 */
export function resolveApiOrigin(env: ProxyEnv, fallback: string): string {
  const configured = env.API_BASE_URL?.trim();
  return (configured || fallback).replace(/\/+$/, "");
}
