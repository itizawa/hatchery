import createClient from "openapi-fetch";

import { clientEnv } from "../config/env.js";
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
