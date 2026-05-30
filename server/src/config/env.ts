import { z } from "zod";

/** server プロセスの実行設定。環境変数から読み出す（テスト容易性のため source を注入可能にする）。 */
export interface ServerEnv {
  /** Express API プロセスの待受ポート。未指定なら 3000。 */
  port: number;
  /** Prisma / PostgreSQL の接続先。バッチ・API の永続化で使う。未設定なら undefined。 */
  databaseUrl: string | undefined;
}

/**
 * 環境変数のスキーマ。プロジェクト標準（ADR-0005/0006）どおり Zod で検証する。
 * PORT は数値に強制し、不正値（"abc" 等）は parse 時に弾く。
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
});

/** 環境変数から ServerEnv を構築する。不正な値は ZodError を投げて起動時に気付けるようにする。 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = EnvSchema.parse({ PORT: source.PORT, DATABASE_URL: source.DATABASE_URL });
  return { port: parsed.PORT, databaseUrl: parsed.DATABASE_URL };
}
