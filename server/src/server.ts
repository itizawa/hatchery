import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrismaDeps } from "./composition/createPrismaDeps.js";
import { registerGracefulShutdown } from "./lifecycle/gracefulShutdown.js";
import { logError, logInfo } from "./logger.js";
import { prisma } from "./persistence/prismaClient.js";
import { createPgSessionStore } from "./persistence/pgSessionStore.js";

/** API プロセスの起動エントリ。createPrismaDeps で Prisma 実装を生成し createApp に注入して listen する（Issue #137）。 */
const env = loadEnv();

const sessionStore = env.databaseUrl ? createPgSessionStore(env.databaseUrl) : undefined;

const googleAuth =
  env.googleClientId && env.googleClientSecret && env.googleCallbackUrl
    ? {
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackUrl: env.googleCallbackUrl,
      }
    : undefined;

const app = createApp({
  ...createPrismaDeps(prisma, env.gcsBucketName),
  sessionStore,
  publicBaseUrl: env.publicBaseUrl,
  googleAuth,
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
    sessionSecret: env.sessionSecret,
    cacheSMaxageSeconds: env.cacheSMaxageSeconds,
    cacheStaleWhileRevalidateSeconds: env.cacheStaleWhileRevalidateSeconds,
  },
});

async function main(): Promise<void> {
  // listen より前に DB 接続を確立しておく。コールドスタート時の初回クエリに接続コストが
  // 乗るのを防ぎ（前倒し）、接続不能なら listen せず exit(1) して Cloud Run に起動失敗を
  // 伝える（健全な旧リビジョンが維持され、全リクエストが 500 になるインスタンスを公開しない）。
  try {
    await prisma.$connect();
    logInfo({ event: "server.database_connected" });
  } catch (err) {
    logError({ event: "server.database_connection_failed", err });
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logInfo({ event: "server.listening", fields: { port: env.port } });
  });

  // listen 失敗（ポート使用中等）は 'error' イベントで飛ぶ。ハンドラが無いと
  // 不明瞭な uncaught 例外でクラッシュするため、明示的にログして exit する。
  server.on("error", (err) => {
    logError({ event: "server.listen_error", err });
    process.exit(1);
  });

  // http.Server レベルのタイムアウト（#34）。スロークライアント/遅い処理でコネクションが
  // 占有され続けるのを防ぐバックストップ。アプリ側ミドルウェアの 503 を先に返すため、
  // http.Server 側はミドルウェアの requestTimeoutMs より長く設定してレース（408/接続リセット
  // との競合）を避ける。headersTimeout はさらに長くする。
  server.requestTimeout = env.requestTimeoutMs + 5_000;
  server.headersTimeout = env.requestTimeoutMs + 10_000;

  // Cloud Run の scale-down / デプロイ時の SIGTERM で、処理中リクエストを排出してから
  // DB 接続を切る。これが無いとインスタンス遷移のたびに in-flight リクエストが 500 になる。
  registerGracefulShutdown({
    server,
    disconnect: () => prisma.$disconnect(),
  });
}

void main();
