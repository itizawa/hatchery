import express, { type Express } from "express";
import session from "express-session";

import { createPassport } from "./auth/passport.js";
import { SECURITY_DEFAULTS } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createCors } from "./middleware/cors.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { createJsonBodyParser, createRequestTimeout } from "./middleware/requestLimits.js";
import { createSecureHeaders } from "./middleware/secureHeaders.js";
import {
  InMemoryChannelMembershipRepository,
  type ChannelMembershipRepository,
} from "./persistence/channelMembershipRepository.js";
import {
  InMemoryChannelRepository,
  type ChannelRepository,
} from "./persistence/channelRepository.js";
import {
  InMemoryEmployeeRepository,
  type EmployeeRepository,
} from "./persistence/employeeRepository.js";
import type { MessageRepository } from "./persistence/messageRepository.js";
import { InMemoryUserRepository, type UserRepository } from "./persistence/userRepository.js";
import {
  InMemoryAppSettingRepository,
  type AppSettingRepository,
} from "./persistence/appSettingRepository.js";
import {
  InMemoryBatchRunLogRepository,
  type BatchRunLogRepository,
} from "./persistence/batchRunLogRepository.js";
import {
  InMemoryInvitationLinkRepository,
  type InvitationLinkRepository,
} from "./persistence/invitationLinkRepository.js";
import { createAdminRouter } from "./routes/admin.js";
import { createBatchLogsRouter } from "./routes/batch-logs.js";
import { createAuthRouter } from "./routes/auth.js";
import { createChannelsRouter } from "./routes/channels.js";
import { createEmployeesRouter } from "./routes/employees.js";
import { healthRouter } from "./routes/health.js";
import { createInvitationsRouter } from "./routes/invitations.js";
import { createMessagesRouter } from "./routes/messages.js";
import { createPlanningIssuesRouter } from "./routes/planning-issues.js";

/** DDoS/過負荷対策（#34）の設定。未指定の項目は安全な既定値を使う。 */
export interface SecurityOptions {
  /** レート制限ウィンドウ長（ミリ秒）。既定 60000。 */
  rateLimitWindowMs?: number;
  /** レート制限のウィンドウあたり最大リクエスト数（IP ごと）。既定 300。 */
  rateLimitMax?: number;
  /** リクエストボディサイズ上限（express.json の limit 記法）。既定 "100kb"。 */
  bodyLimit?: string;
  /** リクエストタイムアウト（ミリ秒）。既定 30000。 */
  requestTimeoutMs?: number;
  /** CORS で許可するオリジンのリスト（#35）。既定 []（＝全オリジン不許可）。`"*"` で全許可。 */
  corsAllowedOrigins?: string[];
  /** HSTS（Strict-Transport-Security）を付与するか（#35）。HTTPS（本番）でのみ true。既定 false。 */
  enableHsts?: boolean;
  /**
   * セッション cookie をクロスサイト（別ドメイン）でも送信できるようにするか（#78）。
   * フロント（Cloudflare Pages）と API（Cloud Run）が別ドメインの本番/dev で true。
   * true で SameSite=None + Secure（HTTPS 前提）。ローカル同一オリジンは false（SameSite=Lax）。既定 false。
   */
  crossSiteCookie?: boolean;
}

/** SecurityOptions の既定値（env.ts と共有＝単一情報源。本番は server.ts が env から渡す）。 */
const DEFAULT_SECURITY: Required<SecurityOptions> = {
  ...SECURITY_DEFAULTS,
  corsAllowedOrigins: [],
  enableHsts: false,
  crossSiteCookie: false,
};

/**
 * セッション cookie の属性を組み立てる（#78）。
 * crossSiteCookie=true（別ドメイン配信）では SameSite=None + Secure とし、ブラウザが
 * クロスサイトでも cookie を送信できるようにする（Secure は HTTPS 必須＝Cloud Run 前提）。
 * false（ローカル同一オリジン）では SameSite=Lax + 非 Secure（http://localhost で送信可能）。
 */
export function buildSessionCookieOptions(crossSiteCookie: boolean) {
  return {
    httpOnly: true,
    sameSite: crossSiteCookie ? ("none" as const) : ("lax" as const),
    secure: crossSiteCookie,
    maxAge: 24 * 60 * 60 * 1000,
  };
}

/** createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。 */
export interface AppDeps {
  messageRepository: MessageRepository;
  /** 省略時はテスト用の空リポジトリを使用。本番では PrismaUserRepository を渡す。 */
  userRepository?: UserRepository;
  /** チャンネル所属（多対多）の永続化。省略時はインメモリ（#33）。 */
  channelMembershipRepository?: ChannelMembershipRepository;
  /** チャンネル CRUD の永続化。省略時はインメモリ（#37）。 */
  channelRepository?: ChannelRepository;
  /** Employee CRUD の永続化。省略時はインメモリ（#38）。 */
  employeeRepository?: EmployeeRepository;
  /** アプリ設定（API キー等）の永続化。省略時はインメモリ（#52）。 */
  appSettingRepository?: AppSettingRepository;
  /** バッチ実行ログの永続化。省略時はインメモリ（#75）。 */
  batchRunLogRepository?: BatchRunLogRepository;
  /** 招待リンクの永続化。省略時はインメモリ（#131）。 */
  invitationLinkRepository?: InvitationLinkRepository;
  /** DDoS/過負荷対策の設定（#34）。省略時は既定値。 */
  security?: SecurityOptions;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const userRepository = deps.userRepository ?? new InMemoryUserRepository();
  const channelMembershipRepository =
    deps.channelMembershipRepository ?? new InMemoryChannelMembershipRepository();
  const channelRepository = deps.channelRepository ?? new InMemoryChannelRepository();
  const employeeRepository = deps.employeeRepository ?? new InMemoryEmployeeRepository();
  const appSettingRepository = deps.appSettingRepository ?? new InMemoryAppSettingRepository();
  const batchRunLogRepository =
    deps.batchRunLogRepository ?? new InMemoryBatchRunLogRepository();
  const invitationLinkRepository =
    deps.invitationLinkRepository ?? new InMemoryInvitationLinkRepository();

  const security = { ...DEFAULT_SECURITY, ...deps.security };

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET 環境変数が設定されていません。本番環境では必須です。");
  }

  // セキュアヘッダ／CORS（#35）は最前段に置き、エラー応答も含む全レスポンスに効かせる。
  // CORS のプリフライト（OPTIONS）は createCors が 204 で打ち切るため、レート制限等より前に置く。
  app.use(createSecureHeaders({ enableHsts: security.enableHsts }));
  app.use(createCors({ allowedOrigins: security.corsAllowedOrigins }));
  app.use(createRequestLogger());

  // DDoS/過負荷対策（#34）はボディ解釈より前に置き、過大・過多なリクエストを早期に弾く。
  // 注: レート制限は req.ip ごとに数える。リバースプロキシ/LB の背後で運用する場合は、
  //     正しいクライアント IP を得るためデプロイ側で app.set("trust proxy", ...) の設定が必要
  //     （未設定だと全クライアントがプロキシ IP に集約される）。本 MVP は単一プロセス前提。
  app.use(createRateLimiter({ windowMs: security.rateLimitWindowMs, max: security.rateLimitMax }));
  app.use(createRequestTimeout(security.requestTimeoutMs));
  app.use(createJsonBodyParser(security.bodyLimit));

  // クロスサイト cookie（別ドメイン配信）では Secure cookie をプロキシ（Cloud Run）背後で
  // 発行するため trust proxy が必須。これが無いと express-session が接続を非 HTTPS と判断し、
  // Secure cookie をセットしない（#78）。
  if (security.crossSiteCookie) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: sessionSecret ?? "hatchery-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: buildSessionCookieOptions(security.crossSiteCookie),
    }),
  );

  const passportInstance = createPassport(userRepository);
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  app.use("/health", healthRouter);
  app.use("/auth", createAuthRouter(passportInstance, userRepository));
  app.use("/messages", createMessagesRouter(deps.messageRepository));
  app.use(
    "/channels",
    createChannelsRouter(channelMembershipRepository, channelRepository, deps.messageRepository),
  );
  app.use("/employees", createEmployeesRouter(employeeRepository));
  app.use("/admin/batch-logs", createBatchLogsRouter(batchRunLogRepository));
  app.use("/admin", createAdminRouter(appSettingRepository, invitationLinkRepository));
  app.use("/invitations", createInvitationsRouter(invitationLinkRepository, userRepository));
  app.use("/channels", createPlanningIssuesRouter(deps.messageRepository));
  app.use(errorHandler);
  return app;
}
