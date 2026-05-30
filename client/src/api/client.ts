import createClient from "openapi-fetch";

// openapi.gen.ts は `pnpm gen-types` で生成される（*.gen.ts はgitignore済み）。
// Turborepo のタスク依存（server#openapi → gen-types → build）でビルド前に自動生成される。
import type { paths } from "./openapi.gen.js";

/** openapi-fetch の型安全クライアント（ADR-0006）。baseUrl は空文字でオリジン相対。 */
export const openApiClient = createClient<paths>({
  baseUrl: "",
});
