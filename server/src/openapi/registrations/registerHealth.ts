import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/**
 * ヘルスチェック（routes/health.ts。/health と /api/health でマウント）の OpenAPI 登録（#535, #925）。
 */
export function registerHealth(registry: OpenAPIRegistry): void {
  const healthResponse = {
    200: {
      description: "稼働中",
      content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
    },
  };
  registry.registerPath({
    method: "get",
    path: "/health",
    summary: "ヘルスチェック",
    responses: healthResponse,
  });
  registry.registerPath({
    method: "get",
    path: "/api/health",
    summary: "ヘルスチェック（Cloud Scheduler warmup 用）",
    responses: healthResponse,
  });
}
