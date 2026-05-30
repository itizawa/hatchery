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
}

/**
 * 環境変数のスキーマ。プロジェクト標準（ADR-0005/0006）どおり Zod で検証する。
 * 数値項目は coerce で数値に強制し、不正値（"abc" や非正の値）は parse 時に弾く。
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  REQUEST_BODY_LIMIT: z.string().min(1).default("100kb"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
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
  });
  return {
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    bodyLimit: parsed.REQUEST_BODY_LIMIT,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
  };
}
