import createClient from "openapi-fetch";

// openapi.gen.ts は `pnpm gen-types` で生成される（*.gen.ts はgitignore済み）。
// Turborepo のタスク依存（server#openapi → gen-types → build）でビルド前に自動生成される。
import type { paths } from "./openapi.gen.js";

// baseUrl はオリジン（同一オリジン相対）。空文字だと openapi-fetch 内部の `new Request("/path")` が
// 相対 URL を解決できず（ブラウザ外＝jsdom/Node で）失敗するため、利用可能なら location.origin を使う。
const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

/** openapi-fetch の型安全クライアント（ADR-0006）。同一オリジン相対で API を呼ぶ。 */
export const openApiClient = createClient<paths>({
  baseUrl,
  // createClient は生成時の globalThis.fetch を束縛してしまうため、呼び出し時に解決する薄い委譲を渡す
  // （テストでの差し替えを可能にし、束縛タイミング由来の不具合を避ける）。
  fetch: (...args) => globalThis.fetch(...args),
});
