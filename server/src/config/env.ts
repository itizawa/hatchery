import { z } from "zod";

import { CACHE_DEFAULTS } from "./security.js";

/** server プロセスの実行設定。環境変数から読み出す（テスト容易性のため source を注入可能にする）。 */
export interface ServerEnv {
  /** Express API プロセスの待受ポート。未指定なら 3000。 */
  port: number;
  /** Prisma / PostgreSQL の接続先。バッチ・ API の永続化で使う。未設定なら undefined。 */
  databaseUrl: string | undefined;
  /** レート制限のウィンドウ長（ミリ秒）。未指定なら 60000（1 分）。 */
  rateLimitWindowMs: number;
  /** レート制限のウィンドウあたり最大リクエスト数（IP ごと）。未指定なら 300。 */
  rateLimitMax: number;
  /** リクエストボディサイズ上限（express.json の limit 記法）。未指定なら "100kb"。 */
  bodyLimit: string;
  /** リクエストタイムアウト（ミリ秒）。未指定なら 30000。 */
  requestTimeoutMs: number;
  /** CORS で許可するオリジンのリスト（#35）。未設定なら空配列（＝全オリジン不許可）。 */
  corsAllowedOrigins: string[];
  /** sitemap.xml が出力する公開ページの絶対 URL ベース（#259）。未設定なら本番フロント既定値。 */
  publicBaseUrl: string;
  /** express-session の署名秘密鍵（#344）。本番では必須。未設定なら undefined。 */
  sessionSecret: string | undefined;
  /** AES-256-GCM 暗号鍵の元になるシークレット（#418）。本番では必須。未設定なら undefined。 */
  appSecret: string | undefined;
  /** Google OAuth クライアント ID（#343）。未設定なら Google 認証エンドポイントを無効化。 */
  googleClientId: string | undefined;
  /** Google OAuth クライアントシークレット（#343）。未設定なら Google 認証エンドポイントを無効化。 */
  googleClientSecret: string | undefined;
  /** Google OAuth コールバック URL（#343）。未設定なら Google 認証エンドポイントを無効化。 */
  googleCallbackUrl: string | undefined;
  /** バッチの API キーフォールバック（#419）。DB に CLAUDE_API_KEY 未設定のときに使う。未設定なら undefined。 */
  anthropicApiKey: string | undefined;
  /** GCS バケット名（#419）。設定時は GcsStorageService を使う。未設定なら InMemoryStorageService。 */
  gcsBucketName: string | undefined;
  /** シーン生成バッチで使う Claude モデル（#389 AC1）。許可値のみ。既定 claude-sonnet-4-6。 */
  batchModel: BatchModel;
  /** プロンプトに載せる直近 post/comment 件数（#389 AC2）。1〜50。既定 30。 */
  batchRecentLimit: number;
  /** 公開 GET の Cache-Control s-maxage（秒・#559）。未指定なら CACHE_DEFAULTS.sMaxageSeconds。 */
  cacheSMaxageSeconds: number;
  /** 公開 GET の Cache-Control stale-while-revalidate（秒・#559）。未指定なら CACHE_DEFAULTS.staleWhileRevalidateSeconds。 */
  cacheStaleWhileRevalidateSeconds: number;
}

/**
 * シーン生成バッチで許可する Claude モデル（#389 AC1 / ADR-0023）。
 * - claude-sonnet-4-6: 既定。入力 $3 / 出力 $15 per 1M tok。
 * - claude-haiku-4-5: 低コスト枠。入力 $1 / 出力 $5 per 1M tok。品質許容ならコストを約 1/3 に。
 * 値を増やすときはここだけ書き換える（Zod enum と型が連動する）。
 */
export const ALLOWED_BATCH_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5"] as const;

/** 許可されたバッチモデルの型（#389 AC1）。 */
export type BatchModel = (typeof ALLOWED_BATCH_MODELS)[number];

/** バッチモデルの既定値（#389 AC1）。 */
export const DEFAULT_BATCH_MODEL: BatchModel = "claude-sonnet-4-6";

/** 直近ログ件数の既定値（#389 AC2）。runCommunityBatch の DEFAULT_RECENT_LIMIT と一致させる。 */
export const DEFAULT_BATCH_RECENT_LIMIT = 30;

/** 直近ログ件数の許容範囲（#389 AC2）。表示・トークン・DB 負荷を踏まえた上下限。 */
export const BATCH_RECENT_LIMIT_MIN = 1;
export const BATCH_RECENT_LIMIT_MAX = 50;

/** 公開ページのベース URL の既定値（#259）。client の DEFAULT_OGP_URL と同じドメイン。 */
export const DEFAULT_PUBLIC_BASE_URL = "https://hatchery.pages.dev";

/**
 * DDoS/過負荷対策（#34）の既定値。Zod のデフォルトと createApp（app.ts）の双方が
 * 参照する単一情報源。値を変えるときはここだけを書き換える。
 */
export const SECURITY_DEFAULTS = {
  rateLimitWindowMs: 60_000,
  rateLimitMax: 300,
  bodyLimit: "100kb",
  requestTimeoutMs: 30_000,
} as const;

/**
 * 環境変数のスキーマ。プロジェクト標準（ADR-0005/0006）どおり Zod で検証する。
 * 数値項目は coerce で数値に強制し、不正値（"abc" や非正の値）は parse 時に弾く。
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(SECURITY_DEFAULTS.rateLimitWindowMs),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(SECURITY_DEFAULTS.rateLimitMax),
  REQUEST_BODY_LIMIT: z.string().min(1).default(SECURITY_DEFAULTS.bodyLimit),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(SECURITY_DEFAULTS.requestTimeoutMs),
  PUBLIC_BASE_URL: z.string().url().default(DEFAULT_PUBLIC_BASE_URL),
  // カンマ区切りのオリジン文字列を配列へ整形する（前後空白除去・空要素除去）。未設定は空配列。
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  SESSION_SECRET: z.string().min(1).optional(),
  APP_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  GCS_BUCKET_NAME: z.string().min(1).optional(),
  // シーン生成バッチのモデル（#389 AC1）。許可値のみ。既定 sonnet-4-6。不正値は parse 時に throw。
  BATCH_MODEL: z.enum(ALLOWED_BATCH_MODELS).default(DEFAULT_BATCH_MODEL),
  // 直近ログ件数（#389 AC2）。1〜50 に制限。既定 30。範囲外・非数値は parse 時に throw。
  BATCH_RECENT_LIMIT: z.coerce
    .number()
    .int()
    .min(BATCH_RECENT_LIMIT_MIN)
    .max(BATCH_RECENT_LIMIT_MAX)
    .default(DEFAULT_BATCH_RECENT_LIMIT),
  // 公開 GET の Cache-Control 秒数（#559）。未設定は CACHE_DEFAULTS。非正・非数値は parse 時に throw。
  CACHE_S_MAXAGE_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(CACHE_DEFAULTS.sMaxageSeconds),
  CACHE_STALE_WHILE_REVALIDATE_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(CACHE_DEFAULTS.staleWhileRevalidateSeconds),
});

/** 環境変数から ServerEnv を構築する。不正な値は ZodError を投げて起動時に気付けるようにする。 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = EnvSchema.parse({
    PORT: source.PORT,
    DATABASE_URL: source.DATABASE_URL,
    RATE_LIMIT_WINDOW_MS: source.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX: source.RATE_LIMIT_MAX,
    REQUEST_BODY_LIMIT: source.REQUEST_BODY_LIMIT,
    REQUEST_TIMEOUT_MS: source.REQUEST_TIMEOUT_MS,
    PUBLIC_BASE_URL: source.PUBLIC_BASE_URL,
    CORS_ALLOWED_ORIGINS: source.CORS_ALLOWED_ORIGINS,
    SESSION_SECRET: source.SESSION_SECRET,
    APP_SECRET: source.APP_SECRET,
    GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: source.GOOGLE_CALLBACK_URL,
    ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY,
    GCS_BUCKET_NAME: source.GCS_BUCKET_NAME,
    BATCH_MODEL: source.BATCH_MODEL,
    BATCH_RECENT_LIMIT: source.BATCH_RECENT_LIMIT,
    CACHE_S_MAXAGE_SECONDS: source.CACHE_S_MAXAGE_SECONDS,
    CACHE_STALE_WHILE_REVALIDATE_SECONDS: source.CACHE_STALE_WHILE_REVALIDATE_SECONDS,
  });
  return {
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    bodyLimit: parsed.REQUEST_BODY_LIMIT,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    sessionSecret: parsed.SESSION_SECRET,
    appSecret: parsed.APP_SECRET,
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: parsed.GOOGLE_CALLBACK_URL,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    gcsBucketName: parsed.GCS_BUCKET_NAME,
    batchModel: parsed.BATCH_MODEL,
    batchRecentLimit: parsed.BATCH_RECENT_LIMIT,
    cacheSMaxageSeconds: parsed.CACHE_S_MAXAGE_SECONDS,
    cacheStaleWhileRevalidateSeconds: parsed.CACHE_STALE_WHILE_REVALIDATE_SECONDS,
  };
}
