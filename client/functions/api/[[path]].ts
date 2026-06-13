import { buildTargetUrl, resolveApiOrigin, type ProxyEnv } from "./proxy";

/**
 * `/api/*` を Cloud Run（server）へ逆プロキシする Pages Function（#78）。
 *
 * フロント（Cloudflare Pages）と API（Cloud Run）が別サイトだと、セッション Cookie が
 * サードパーティ Cookie 扱いになり、最近のブラウザにブロック/破棄されて Google ログインが
 * 通らない。Pages 経由で同一オリジン（develop.hatchery.pages.dev/api/*）へ集約することで
 * Cookie が第一者になり、OAuth コールバックも `/api/auth/me` も確実に Cookie を伴う。
 *
 * 302（Google への遷移・ログイン後のフロント遷移）はブラウザへそのまま返す（redirect: "manual"）。
 * `_middleware.ts`（Basic 認証）は `/api/*` を除外しているため、Google からのコールバック遷移が
 * Basic 認証で弾かれることはない。
 */
interface PagesContext {
  request: Request;
  env: ProxyEnv;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}

// dev（develop.hatchery.pages.dev）が対応する Cloud Run の既定オリジン。
// Pages ランタイム環境変数 API_BASE_URL が設定されていればそちらを優先する。
const DEFAULT_API_ORIGIN = "https://hatchery-4dyskz5cga-an.a.run.app";

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const apiOrigin = resolveApiOrigin(env, DEFAULT_API_ORIGIN);
  const targetUrl = buildTargetUrl(apiOrigin, request.url);

  // Host はターゲット URL から自動設定させたいため転送ヘッダから除外する。
  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const proxied = new Request(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
  return fetch(proxied);
};
