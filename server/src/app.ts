import express, { type Express } from "express";
import session, { type Store } from "express-session";

import { createPassport, type GoogleAuthConfig } from "./auth/passport.js";
import { DEFAULT_PUBLIC_BASE_URL, SECURITY_DEFAULTS } from "./config/env.js";
import { CACHE_DEFAULTS } from "./config/security.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createCors } from "./middleware/cors.js";
import { createNoStoreCache, createPublicCache } from "./middleware/cacheControl.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { createJsonBodyParser, createRequestTimeout } from "./middleware/requestLimits.js";
import { createSecureHeaders } from "./middleware/secureHeaders.js";
import type { AppSettingRepository } from "./persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "./persistence/batchRunLogRepository.js";
import type { CommunityRepository } from "./persistence/communityRepository.js";
import type { CommentRepository } from "./persistence/commentRepository.js";
import type { WorkerRepository } from "./persistence/workerRepository.js";
import type { WorkerCommunityRepository } from "./persistence/workerCommunityRepository.js";
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
import { createAdminCommunityImageRouter } from "./routes/adminCommunityImage.js";
import { createAdminWorkerCommunitiesRouter } from "./routes/adminWorkerCommunities.js";
import { createBatchLogsRouter } from "./routes/batch-logs.js";
import { createTokenUsageRouter } from "./routes/token-usage.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCommunitiesRouter } from "./routes/communities.js";
import { createWorkersRouter } from "./routes/workers.js";
import { createFeedRouter } from "./routes/feed.js";
import { healthRouter } from "./routes/health.js";
import { createPostsRouter } from "./routes/posts.js";
import { createSitemapRouter } from "./routes/sitemap.js";

/** DDoS/過負荷対策（#34）の設定。未指定の項目は安全な既定値を使う。 */
export interface SecurityOptions {
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  bodyLimit?: string;
  requestTimeoutMs?: number;
  corsAllowedOrigins?: string[];
  enableHsts?: boolean;
  crossSiteCookie?: boolean;
  sessionSecret?: string;
  /** 公開 GET の Cache-Control s-maxage（秒・#559）。未指定なら CACHE_DEFAULTS.sMaxageSeconds。 */
  cacheSMaxageSeconds?: number;
  /** 公開 GET の Cache-Control stale-while-revalidate（秒・#559）。未指定なら CACHE_DEFAULTS。 */
  cacheStaleWhileRevalidateSeconds?: number;
}

const DEFAULT_SECURITY: Required<SecurityOptions> = {
  ...SECURITY_DEFAULTS,
  corsAllowedOrigins: [],
  enableHsts: false,
  crossSiteCookie: false,
  sessionSecret: "hatchery-dev-secret",
  cacheSMaxageSeconds: CACHE_DEFAULTS.sMaxageSeconds,
  cacheStaleWhileRevalidateSeconds: CACHE_DEFAULTS.staleWhileRevalidateSeconds,
};

export function buildSessionCookieOptions(crossSiteCookie: boolean) {
  return {
    httpOnly: true,
    sameSite: crossSiteCookie ? ("none" as const) : ("lax" as const),
    secure: crossSiteCookie,
    maxAge: 24 * 60 * 60 * 1000,
  };
}

export interface AppDeps {
  userRepository: UserRepository;
  workerRepository: WorkerRepository;
  workerCommunityRepository: WorkerCommunityRepository;
  appSettingRepository: AppSettingRepository;
  batchRunLogRepository: BatchRunLogRepository;
  tokenUsageLogRepository: TokenUsageLogRepository;
  communityRepository: CommunityRepository;
  postRepository: PostRepository;
  commentRepository: CommentRepository;
  subscriptionRepository: SubscriptionRepository;
  voteRepository: VoteRepository;
  worldStateRepository: WorldStateRepository;
  storageService: StorageService;
  security?: SecurityOptions;
  sessionStore?: Store;
  publicBaseUrl?: string;
  googleAuth?: GoogleAuthConfig;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  const security = { ...DEFAULT_SECURITY, ...deps.security };

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

  // Cache-Control 方針（#559）。公開・コンテンツのみの GET（未認証時）はエッジ/ブラウザに
  // キャッシュさせ、認証系・管理系・ユーザー個別の応答は共有キャッシュに載せない。
  const publicCache = createPublicCache({
    sMaxageSeconds: security.cacheSMaxageSeconds,
    staleWhileRevalidateSeconds: security.cacheStaleWhileRevalidateSeconds,
  });
  const noStoreCache = createNoStoreCache();

  if (isApiDocsEnabled(process.env)) {
    app.use("/", createApiDocsRouter());
  }

  app.use("/health", healthRouter);
  app.use(
    "/sitemap.xml",
    publicCache,
    createSitemapRouter(communityRepo, deps.publicBaseUrl ?? DEFAULT_PUBLIC_BASE_URL),
  );
  app.use(
    "/api/auth",
    noStoreCache,
    createAuthRouter(
      passportInstance,
      deps.userRepository,
      deps.googleAuth,
      process.env.NODE_ENV ?? "development",
      // #78: OAuth 後の戻り先はフロント（公開ページ）のオリジン。sitemap と同じ publicBaseUrl を使う。
      deps.publicBaseUrl ?? DEFAULT_PUBLIC_BASE_URL,
    ),
  );
  app.use("/api/workers", publicCache, createWorkersRouter(deps.workerRepository));
  app.use("/api/admin/batch-logs", noStoreCache, createBatchLogsRouter(deps.batchRunLogRepository));
  app.use(
    "/api/admin/token-usage",
    noStoreCache,
    createTokenUsageRouter(deps.tokenUsageLogRepository),
  );
  app.use(
    "/api/admin",
    noStoreCache,
    createAdminRouter(
      deps.appSettingRepository,
      deps.workerRepository,
      communityRepo,
      postRepo,
      commentRepo,
    ),
  );
  app.use(
    "/api/admin",
    noStoreCache,
    createAdminWorkerImageRouter(deps.workerRepository, deps.storageService),
  );
  app.use(
    "/api/admin",
    noStoreCache,
    createAdminCommunityImageRouter(communityRepo, deps.storageService),
  );
  app.use(
    "/api/admin",
    noStoreCache,
    createAdminWorkerCommunitiesRouter(
      deps.workerRepository,
      deps.workerCommunityRepository,
      communityRepo,
    ),
  );
  app.use(
    "/api/communities",
    publicCache,
    createCommunitiesRouter(communityRepo, postRepo, subscriptionRepo, deps.workerRepository),
  );
  app.use("/api/feed", publicCache, createFeedRouter(postRepo, deps.workerRepository));
  app.use(
    "/api",
    publicCache,
    createPostsRouter(postRepo, commentRepo, voteRepo, deps.workerRepository),
  );

  app.use(errorHandler);
  return app;
}
