import createClient from "openapi-fetch";

import { clientEnv } from "../config/env.js";
import { buildApiErrorMessage } from "./errors.js";
// openapi.gen.ts は `pnpm gen-types` で生成される（*.gen.ts はgitignore済み）。
// Turborepo のタスク依存（server#openapi → gen-types → build）でビルド前に自動生成される。
import type { paths } from "./openapi.gen.js";

// baseUrl の解決: VITE_API_BASE_URL が設定されていればそれを使う（#78 のクロスオリジン配信
// = Cloudflare Pages × Cloud Run 向け）。未設定なら従来どおり同一オリジン相対で呼ぶ。空文字だと
// openapi-fetch 内部の `new Request("/path")` が相対 URL を解決できず（ブラウザ外＝jsdom/Node で）
// 失敗するため、利用可能なら location.origin を使う。
// 全画面遷移（Google ログイン等、openapi-fetch を通さない素のブラウザ遷移）でも同じ baseUrl を
// 使えるよう公開する（#78）。これを使わず相対パスへ遷移すると Pages 側に飛んで Not Found になる。
export const apiBaseUrl =
  clientEnv.apiBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

/** openapi-fetch の型安全クライアント（ADR-0006）。既定は同一オリジン相対、VITE_API_BASE_URL で上書き可。 */
export const openApiClient = createClient<paths>({
  baseUrl: apiBaseUrl,
  // createClient は生成時の globalThis.fetch を束縛してしまうため、呼び出し時に解決する薄い委譲を渡す
  // （テストでの差し替えを可能にし、束縛タイミング由来の不具合を避ける）。
  fetch: (...args) => globalThis.fetch(...args),
});

// 開発環境のみ: VITE_API_DELAY_MS を設定するとすべての API リクエストに遅延が入る（楽観更新確認用）。
// 例: client/.env.development.local に `VITE_API_DELAY_MS=2000` を追記。
if (import.meta.env?.DEV) {
  const delayMs = Number(import.meta.env.VITE_API_DELAY_MS ?? 0);
  if (delayMs > 0) {
    openApiClient.use({
      async onRequest({ request }) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        return request;
      },
    });
  }
}

// ─── レスポンス検証ヘルパー（#532）──────────────────────────────────────────────
// 各 fetcher が反復していた `if (error || !response.ok || !data) throw new Error(...)` を集約する。
// throw する際はサーバのエラーボディ（`{ error: string }`）があれば buildApiErrorMessage で
// 抽出して Error message に含め、呼び出し側で具体的な失敗理由を提示できるようにする（#476）。

/** openapi-fetch の戻り値（`{ data, error, response }`）を模した最小の結果型。 */
type FetchResult<T, E> = {
  data?: T;
  error?: E;
  response: Response;
};

/**
 * openapi-fetch の戻りを検証して **data 必須**で返す（#532）。
 * `error` あり / `!response.ok` / `data` が null・undefined のいずれかなら throw する。
 * 成功時の戻り型は `data` を non-null に絞った型。
 *
 * @param result openapi-fetch の `{ data, error, response }`
 * @param label フォールバック文言（例: `"GET /api/admin/settings"`）。サーバボディが無いとき
 *   `"<label> (<status>)"` 形式で Error message に使う。
 */
export function unwrap<T, E>({ result, label }: { result: FetchResult<T, E>; label: string }): NonNullable<T> {
  const { data, error, response } = result;
  if (error || !response.ok || data == null) {
    throw new Error(buildApiErrorMessage(error, response.status, label));
  }
  return data as NonNullable<T>;
}

/**
 * openapi-fetch の戻りを検証して **レスポンスの成否のみ**を保証し `data` を返す（#532）。
 * 空ボディ（`data` undefined）を許容するフェッチャ（`data ?? []` する一覧取得や void 破棄）向け。
 * `error` あり / `!response.ok` なら throw する。`data` の有無は問わない。
 *
 * @param result openapi-fetch の `{ data, error, response }`
 * @param label フォールバック文言（`unwrap` と同様）
 */
export function ensureOk<T, E>({ result, label }: { result: FetchResult<T, E>; label: string }): T | undefined {
  const { data, error, response } = result;
  if (error || !response.ok) {
    throw new Error(buildApiErrorMessage(error, response.status, label));
  }
  return data;
}
