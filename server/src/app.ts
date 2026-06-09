import express, { type Express } from "express";
import session, { type Store } from "express-session";

import { createPassport } from "./auth/passport.js";
import { SECURITY_DEFAULTS } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createCors } from "./middleware/cors.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { createJsonBodyParser, createRequestTimeout } from "./middleware/requestLimits.js";
import { createSecureHeaders } from "./middleware/secureHeaders.js";
import type { AppSettingRepository } from "./persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "./persistence/batchRunLogRepository.js";
import type { ChannelMembershipRepository } from "./persistence/channelMembershipRepository.js";
import type { ChannelRepository } from "./persistence/channelRepository.js";
import type { CommunityRepository } from "./persistence/communityRepository.js";
import { InMemoryCommunityRepository } from "./persistence/communityRepository.js";
import type { CommentRepository } from "./persistence/commentRepository.js";
import { InMemoryCommentRepository } from "./persistence/commentRepository.js";
import type { EmployeeRepository } from "./persistence/employeeRepository.js";
import type { InvitationLinkRepository } from "./persistence/invitationLinkRepository.js";
import type { MessageRepository } from "./persistence/messageRepository.js";
import type { StorageService } from "./services/storageService.js";
import type { PostRepository } from "./persistence/postRepository.js";
import { InMemoryPostRepository } from "./persistence/postRepository.js";
import type { SubscriptionRepository } from "./persistence/subscriptionRepository.js";
import { InMemorySubscriptionRepository } from "./persistence/subscriptionRepository.js";
import type { TokenUsageLogRepository } from "./persistence/tokenUsageLogRepository.js";
import type { UserRepository } from "./persistence/userRepository.js";
import type { VoteRepository } from "./persistence/voteRepository.js";
import { InMemoryVoteRepository } from "./persistence/voteRepository.js";
import type { WorldStateRepository } from "./persistence/worldStateRepository.js";
import { InMemoryWorldStateRepository } from "./persistence/worldStateRepository.js";
import { createAdminRouter } from "./routes/admin.js";
import { createAdminEmployeeImageRouter } from "./routes/adminEmployeeImage.js";
import { createBatchLogsRouter } from "./routes/batch-logs.js";
import { createTokenUsageRouter } from "./routes/token-usage.js";
import { createAuthRouter } from "./routes/auth.js";
import { createChannelsRouter } from "./routes/channels.js";
import { createCommunitiesRouter } from "./routes/communities.js";
import { createEmployeesRouter } from "./routes/employees.js";
import { createFeedRouter } from "./routes/feed.js";
import { healthRouter } from "./routes/health.js";
import { createInvitationsRouter } from "./routes/invitations.js";
import { createMessagesRouter } from "./routes/messages.js";
import { createPlanningIssuesRouter } from "./routes/planning-issues.js";
import { createPostsRouter } from "./routes/posts.js";

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

/**
 * createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。
 * すべてのリポジトリが必須（Issue #137）。InMemory フォールバックは撤去済み。
 * テスト用合成は server/src/testing/createTestDeps.ts、
 * 本番用合成は server/src/composition/createPrismaDeps.ts を使う。
 */
export interface AppDeps {
  messageRepository: MessageRepository;
  userRepository: UserRepository;
  /** チャンネル所属（多対多）の永続化（#33）。 */
  channelMembershipRepository: ChannelMembershipRepository;
  /** チャンネル CRUD の永続化（#37）。 */
  channelRepository: ChannelRepository;
  /** Employee CRUD の永続化（#38）。 */
  employeeRepository: EmployeeRepository;
  /** アプリ設定（API キー等）の永続化（#52）。 */
  appSettingRepository: AppSettingRepository;
  /** バッチ実行ログの永続化（#75）。 */
  batchRunLogRepository: BatchRunLogRepository;
  /** 招待リンクの永続化（#131）。 */
  invitationLinkRepository: InvitationLinkRepository;
  /** トークン使用量ログの永続化（#153）。 */
  tokenUsageLogRepository: TokenUsageLogRepository;
  /** コミュニティの永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  communityRepository?: CommunityRepository;
  /** 投稿の永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  postRepository?: PostRepository;
  /** コメントの永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  commentRepository?: CommentRepository;
  /** 購読の永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  subscriptionRepository?: SubscriptionRepository;
  /** up vote の永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  voteRepository?: VoteRepository;
  /** ワールド状態の永続化（#305 / ADR-0019）。省略時は空の InMemory 実装。 */
  worldStateRepository?: WorldStateRepository;
  /** GCS ストレージサービス（#204 / ADR-0022）。本番は GcsStorageService、テスト・ローカルは InMemoryStorageService。 */
  storageService: StorageService;
  /** DDoS/過負荷対策の設定（#34）。省略時は既定値。 */
  security?: SecurityOptions;
  /**
   * express-session のセッションストア（#186）。
   * 省略時はプロセス内 MemoryStore（開発・テスト用途のみ）。
   * 本番（NODE_ENV=production）では必須—省略すると起動時例外。
   */
  sessionStore?: Store;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 * 純粋ファクトリ（Issue #137）: 受け取った依存をそのまま配線するだけ。
 * どの実装を使うかの決定は呼び出し側（composition root）に委ねる。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const security = { ...DEFAULT_SECURITY, ...deps.security };

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET 環境変数が設定されていません。本番環境では必須です。");
  }

  if (!deps.sessionStore && process.env.NODE_ENV === "production") {
    throw new Error(
      "sessionStore が必須です。本番環境では connect-pg-simple 等の永続ストアを AppDeps.sessionStore に渡してください（#186）。",
    );
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
      ...(deps.sessionStore ? { store: deps.sessionStore } : {}),
    }),
  );

  const passportInstance = createPassport(deps.userRepository);
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  // 公共コミュニティ用リポジトリ（省略時は空の InMemory 実装を使う）
  const communityRepo = deps.communityRepository ?? new InMemoryCommunityRepository();
  const postRepo = deps.postRepository ?? new InMemoryPostRepository();
  const commentRepo = deps.commentRepository ?? new InMemoryCommentRepository();
  const subscriptionRepo = deps.subscriptionRepository ?? new InMemorySubscriptionRepository();
  const voteRepo = deps.voteRepository ?? new InMemoryVoteRepository();
  const worldStateRepo = deps.worldStateRepository ?? new InMemoryWorldStateRepository();

  app.use("/health", healthRouter);
  app.use("/api/auth", createAuthRouter(passportInstance, deps.userRepository));
  app.use("/api/messages", createMessagesRouter(deps.messageRepository));
  app.use(
    "/api/channels",
    createChannelsRouter(
      deps.channelMembershipRepository,
      deps.channelRepository,
      deps.messageRepository,
      {
        employeeRepo: deps.employeeRepository,
        appSettingRepo: deps.appSettingRepository,
      },
    ),
  );
  app.use("/api/employees", createEmployeesRouter(deps.employeeRepository));
  app.use("/api/admin/batch-logs", createBatchLogsRouter(deps.batchRunLogRepository));
  app.use("/api/admin/token-usage", createTokenUsageRouter(deps.tokenUsageLogRepository));
  app.use("/api/admin", createAdminRouter(deps.appSettingRepository, deps.invitationLinkRepository, deps.employeeRepository, communityRepo));
  app.use(
    "/api/admin",
    createAdminEmployeeImageRouter(deps.employeeRepository, deps.storageService),
  );
  app.use(
    "/api/invitations",
    createInvitationsRouter(deps.invitationLinkRepository, deps.userRepository),
  );
  app.use("/api/channels", createPlanningIssuesRouter(deps.messageRepository));

  // 公共コミュニティ API（#305 / ADR-0019）
  app.use(
    "/api/communities",
    createCommunitiesRouter(communityRepo, postRepo, subscriptionRepo),
  );
  app.use("/api/feed", createFeedRouter(subscriptionRepo, postRepo));
  app.use("/api", createPostsRouter(postRepo, commentRepo, voteRepo));

  void worldStateRepo; // 将来の定時バッチで使用（#306）

  app.use(errorHandler);
  return app;
}
