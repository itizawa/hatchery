import express, { type Express } from "express";
import session, { type Store } from "express-session";

import { createPassport, type GoogleAuthConfig } from "./auth/passport.js";
import { DEFAULT_PUBLIC_BASE_URL, SECURITY_DEFAULTS } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createCors } from "./middleware/cors.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { createJsonBodyParser, createRequestTimeout } from "./middleware/requestLimits.js";
import { createSecureHeaders } from "./middleware/secureHeaders.js";
import type { AppSettingRepository } from "./persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "./persistence/batchRunLogRepository.js";
import type { CommunityRepository } from "./persistence/communityRepository.js";
import type { CommentRepository } from "./persistence/commentRepository.js";
import type { WorkerRepository } from "./persistence/workerRepository.js";
import type { InvitationLinkRepository } from "./persistence/invitationLinkRepository.js";
import type { StorageService } from "./services/storageService.js";
import type { PostRepository } from "./persistence/postRepository.js";
import type { SubscriptionRepository } from "./persistence/subscriptionRepository.js";
import type { TokenUsageLogRepository } from "./persistence/tokenUsageLogRepository.js";
import type { UserRepository } from "./persistence/userRepository.js";
import type { VoteRepository } from "./persistence/voteRepository.js";
import type { WorldStateRepository } from "./persistence/worldStateRepository.js";
import { createAdminRouter } from "./routes/admin.js";
import { createApiDocsRouter, isApiDocsEnabled } from "./routes/apiDocs.js";
import { createAdminWorkerImageRouter } from "./routes/adminWorkerImage.js";
import { createBatchLogsRouter } from "./routes/batch-logs.js";
import { createTokenUsageRouter } from "./routes/token-usage.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCommunitiesRouter } from "./routes/communities.js";
import { createWorkersRouter } from "./routes/workers.js";
import { createFeedRouter } from "./routes/feed.js";
import { healthRouter } from "./routes/health.js";
import { createInvitationsRouter } from "./routes/invitations.js";
import { createPostsRouter } from "./routes/posts.js";
import { createSitemapRouter } from "./routes/sitemap.js";

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
   * true で SameSite=None + Secure（HTTPS 前提）。ローカル同一オリジンは false（SameSite=Lax）。既定 false。
   */
  crossSiteCookie?: boolean;
  /** express-session の署名秘密鍵（#344）。本番では必須。未指定なら開発用既定値。 */
  sessionSecret?: string;
}

/** SecurityOptions の既定値（env.ts と共有＝単一情報源。本番は server.ts が env から渡す）。 */
const DEFAULT_SECURITY: Required<SecurityOptions> = {
  ...SECURITY_DEFAULTS,
  corsAllowedOrigins: [],
  enableHsts: false,
  crossSiteCookie: false,
  sessionSecret: "hatchery-dev-secret",
};

/**
 * セッション cookie の属性を組み立てる（#78）。
 * crossSiteCookie=true（別ドメイン配信）では SameSite=None + Secure とし、ブラウザが
 * クロスサイトでも cookie を送信できるようにする（Secure は HTTPS 必須＝ Cloud Run 前提）。
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
 * createApp の依存（永続化は注入する＝ Express/Prisma からドメインを独立させる）。
 * テスト用合成は server/src/testing/createTestDeps.ts、
 * 本番用合成は server/src/composition/createPrismaDeps.ts を使う。
 */
export interface AppDeps {
  userRepository: UserRepository;
  /** Worker CRUD の永続化（#38）。 */
  workerRepository: WorkerRepository;
  /** アプリ設定（API キー等）の永続化（#52）。 */
  appSettingRepository: AppSettingRepository;
  /** バッチ実行ログの永続化（#75）。 */
  batchRunLogRepository: BatchRunLogRepository;
  /** 招待リンクの永続化（#131）。 */
  invitationLinkRepository: InvitationLinkRepository;
  /** トークン使用量ログの永続化（#153）。 */
  tokenUsageLogRepository: TokenUsageLogRepository;
  /** コミュニティの永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  communityRepository: CommunityRepository;
  /** 投稿の永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  postRepository: PostRepository;
  /** コメントの永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  commentRepository: CommentRepository;
  /** 購読の永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  subscriptionRepository: SubscriptionRepository;
  /** up vote の永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  voteRepository: VoteRepository;
  /** ワールド状態の永続化（ADR-0019）。呼び出し側（composition root）が注入する（#290）。 */
  worldStateRepository: WorldStateRepository;
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
  /**
   * 公開ページの絶対 URL ベース（sitemap.xml 生成に使う・#259）。
   * 省略時は本番フロント既定値（client/vite.config.ts の DEFAULT_OGP_URL と同じ）。
   * 本番は server.ts が env（PUBLIC_BASE_URL）から渡す。
   */
  publicBaseUrl?: string;
  /**
   * Google OAuth 設定（#343 / ADR-0027）。
   * 設定がある場合のみ Google 認証エンドポイントを有効化する。
   * 本番は server.ts が env（GOOGLE_CLIENT_ID 等）から渡す。
   */
  googleAuth?: GoogleAuthConfig;
}

/**
 * Express アプリを生成する（listen はしない＝ supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 * 純粋ファクトリ（Issue #137）: 受け取った依存をそのまま配線するだけ。
 * どの実装を使うかの決定は呼び出し側（composition root）に委ねる。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const security = { ...DEFAULT_SECURITY, ...deps.security };

  // deps.security から直接読む（DEFAULT_SECURITY の "hatchery-dev-secret" を介さない）ことで、
  // sessionSecret を明示しないまま NODE_ENV=production で起動した場合も本番ガードが正しく機能する。
  const sessionSecret = deps.security?.sessionSecret ?? process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (security.corsAllowedOrigins.includes("*")) {
      throw new Error(
        "本番環境で CORS に * は使用できません。CORS_ALLOWED_ORIGINS に具体的なオリジンを設定してください（#344）。",
      );
    }
    if (!sessionSecret) {
      throw new Error("SESSION_SECRET 環境変数が設定されていません。本番環境では必須です。");
    }
    if (!process.env.APP_SECRET) {
      throw new Error("APP_SECRET 環境変数が設定されていません。本番環境では必須です（#418）。");
    }
    if (!deps.sessionStore) {
      throw new Error(
        "sessionStore が必須です。本番環境では connect-pg-simple 等の永続ストアを AppDeps.sessionStore に渡してください（#186）。",
      );
    }
  }

  app.use(createSecureHeaders({ enableHsts: security.enableHsts }));
  app.use(createCors({ allowedOrigins: security.corsAllowedOrigins }));
  app.use(createRequestLogger());

  app.use(createRateLimiter({ windowMs: security.rateLimitWindowMs, max: security.rateLimitMax }));
  app.use(createRequestTimeout(security.requestTimeoutMs));
  app.use(createJsonBodyParser(security.bodyLimit));

  if (security.crossSiteCookie) {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: sessionSecret ?? DEFAULT_SECURITY.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: buildSessionCookieOptions(security.crossSiteCookie),
      ...(deps.sessionStore ? { store: deps.sessionStore } : {}),
    }),
  );

  const passportInstance = createPassport(deps.userRepository, deps.googleAuth);
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  const communityRepo = deps.communityRepository;
  const postRepo = deps.postRepository;
  const commentRepo = deps.commentRepository;
  const subscriptionRepo = deps.subscriptionRepository;
  const voteRepo = deps.voteRepository;
  const worldStateRepo = deps.worldStateRepository;

  if (isApiDocsEnabled(process.env)) {
    app.use("/", createApiDocsRouter());
  }

  app.use("/health", healthRouter);
  app.use(
    "/sitemap.xml",
    createSitemapRouter(communityRepo, deps.publicBaseUrl ?? DEFAULT_PUBLIC_BASE_URL),
  );
  app.use("/api/auth", createAuthRouter(passportInstance, deps.userRepository, deps.googleAuth));
  app.use("/api/workers", createWorkersRouter(deps.workerRepository));
  app.use("/api/admin/batch-logs", createBatchLogsRouter(deps.batchRunLogRepository));
  app.use("/api/admin/token-usage", createTokenUsageRouter(deps.tokenUsageLogRepository));
  app.use("/api/admin", createAdminRouter(deps.appSettingRepository, deps.invitationLinkRepository, deps.workerRepository, communityRepo));
  app.use(
    "/api/admin",
    createAdminWorkerImageRouter(deps.workerRepository, deps.storageService),
  );
  app.use(
    "/api/invitations",
    createInvitationsRouter(deps.invitationLinkRepository, deps.userRepository),
  );
  app.use(
    "/api/communities",
    createCommunitiesRouter(communityRepo, postRepo, subscriptionRepo, deps.workerRepository),
  );
  app.use("/api/feed", createFeedRouter(postRepo));
  app.use("/api", createPostsRouter(postRepo, commentRepo, voteRepo));

  void worldStateRepo;

  app.use(errorHandler);
  return app;
}
