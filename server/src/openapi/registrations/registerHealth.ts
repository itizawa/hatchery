import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/**
 * ヘルスチェック（routes/health.ts。/health でマウント）の OpenAPI 登録（#535）。
 */
export function registerHealth(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/health",
    summary: "ヘルスチェック",
    responses: {
      200: {
        description: "稼働中",
        content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
      },
    },
  });
}
