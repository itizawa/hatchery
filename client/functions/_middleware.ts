import { validateBasicAuth } from "./basicAuth";

interface Env {
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が未設定の場合はスキップ（本番環境での無効化に対応）
export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { env, request, next } = context;

  // `/api/*` は Cloud Run への逆プロキシ（functions/api/[[path]].ts, #78）。Basic 認証を被せると
  // Google からの OAuth コールバック遷移が 401 で弾かれうるため除外する（API 自身がセッション認証を持つ）。
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return next();
  }

  const user = env.BASIC_AUTH_USER;
  const password = env.BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return next();
  }

  const authHeader = request.headers.get("Authorization");

  if (!validateBasicAuth(authHeader, user, password)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Hatchery Dev", charset="UTF-8"',
      },
    });
  }

  return next();
};
