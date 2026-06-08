import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrismaDeps } from "./composition/createPrismaDeps.js";
import { prisma } from "./persistence/prismaClient.js";
import { createPgSessionStore } from "./persistence/pgSessionStore.js";

/** API プロセスの起動エントリ。createPrismaDeps で Prisma 実装を生成し createApp に注入して listen する（Issue #137）。 */
const env = loadEnv();

const sessionStore = env.databaseUrl ? createPgSessionStore(env.databaseUrl) : undefined;

const app = createApp({
  ...createPrismaDeps(prisma),
  sessionStore,
  security: {
    rateLimitWindowMs: env.rateLimitWindowMs,
    rateLimitMax: env.rateLimitMax,
    bodyLimit: env.bodyLimit,
    requestTimeoutMs: env.requestTimeoutMs,
    corsAllowedOrigins: env.corsAllowedOrigins,
    // HSTS は HTTPS 前提のため本番でのみ有効化する（session cookie の secure と同じ判定）。
    enableHsts: process.env.NODE_ENV === "production",
    // フロント（Cloudflare Pages）と API（Cloud Run）が別ドメインの本番/dev では、
    // セッション cookie を SameSite=None + Secure にしないとログインが維持できない（#78）。
    crossSiteCookie: process.env.NODE_ENV === "production",
  },
});

const server = app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
});

// http.Server レベルのタイムアウト（#34）。スロークライアント/遅い処理でコネクションが
// 占有され続けるのを防ぐバックストップ。アプリ側ミドルウェアの 503 を先に返すため、
// http.Server 側はミドルウェアの requestTimeoutMs より長く設定してレース（408/接続リセット
// との競合）を避ける。headersTimeout はさらに長くする。
server.requestTimeout = env.requestTimeoutMs + 5_000;
server.headersTimeout = env.requestTimeoutMs + 10_000;
