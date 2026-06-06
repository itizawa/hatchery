import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { PrismaAppSettingRepository } from "./persistence/prismaAppSettingRepository.js";
import { PrismaChannelMembershipRepository } from "./persistence/prismaChannelMembershipRepository.js";
import { PrismaChannelRepository } from "./persistence/prismaChannelRepository.js";
import { prisma } from "./persistence/prismaClient.js";
import { PrismaEmployeeRepository } from "./persistence/prismaEmployeeRepository.js";
import { PrismaMessageRepository } from "./persistence/prismaMessageRepository.js";
import { PrismaUserRepository } from "./persistence/prismaUserRepository.js";
import { PrismaInvitationLinkRepository } from "./persistence/prismaInvitationLinkRepository.js";

/** API プロセスの起動エントリ。createApp に Prisma 実装を注入して listen する。 */
const env = loadEnv();
const app = createApp({
  messageRepository: new PrismaMessageRepository(prisma),
  userRepository: new PrismaUserRepository(prisma),
  channelMembershipRepository: new PrismaChannelMembershipRepository(prisma),
  channelRepository: new PrismaChannelRepository(prisma),
  employeeRepository: new PrismaEmployeeRepository(prisma),
  appSettingRepository: new PrismaAppSettingRepository(prisma),
  invitationLinkRepository: new PrismaInvitationLinkRepository(prisma),
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
