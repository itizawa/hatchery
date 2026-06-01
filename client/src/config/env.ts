import { z } from "zod";

/** client（ブラウザ）の実行設定。Vite の公開環境変数（`VITE_*`）から読み出す。 */
export interface ClientEnv {
  /**
   * server API のベース URL（オリジン）。未設定なら undefined ＝ 同一オリジン相対で呼ぶ
   * （`api/client.ts` が `window.location.origin` にフォールバック）。クロスオリジン配信
   * （#78: Cloudflare Pages × Cloud Run）では Cloud Run の URL を設定する。
   */
  apiBaseUrl: string | undefined;
  /** クライアントのログレベル。未指定なら "info"。 */
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * 環境変数のスキーマ。server の `config/env.ts` と同じく Zod で検証し、不正値は parse 時に弾く。
 * Vite の値はビルド時に静的に埋め込まれるが、検証（loadClientEnv）はアプリ初期化時に走るため、
 * 不正値はアプリ起動時（モジュール読込時）に ZodError として顕在化する。
 * Vite は `import.meta.env.VITE_*` を自動的にクライアントへ公開する。
 */
const ClientEnvSchema = z.object({
  // 空文字は未設定（同一オリジン）とみなす。値があるときのみ URL 形式を要求する。
  VITE_API_BASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  VITE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/**
 * 環境変数から ClientEnv を構築する。不正な値は ZodError を投げて、開発者がビルド時に
 * 気付けるようにする。テスト容易性のため source を注入可能にする（既定は import.meta.env）。
 */
export function loadClientEnv(source: Record<string, unknown> = import.meta.env): ClientEnv {
  const parsed = ClientEnvSchema.parse({
    VITE_API_BASE_URL: source.VITE_API_BASE_URL,
    VITE_LOG_LEVEL: source.VITE_LOG_LEVEL,
  });
  return {
    apiBaseUrl: parsed.VITE_API_BASE_URL,
    logLevel: parsed.VITE_LOG_LEVEL,
  };
}

/** モジュール読込時に検証済みの client 環境設定。不正値ならここで起動を止める。 */
export const clientEnv = loadClientEnv();
