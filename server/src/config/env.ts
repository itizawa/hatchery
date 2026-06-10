import { z } from "zod";

/** server プロセスの実行設定。環境変数から読み出す（テスト容易性のため source を注入可能にする）。 */
export interface ServerEnv {
  /** Express API プロセスの待受ポート。未指定なら 3000。 */
  port: number;
  /** Prisma / PostgreSQL の接続先。バッチ・API の永続化で使う。未設定なら undefined。 */
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
}

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
  };
}
