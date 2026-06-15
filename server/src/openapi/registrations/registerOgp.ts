import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { OgpMetaSchema, OGP_URL_MAX_LENGTH } from "@hatchery/common";
import { z } from "zod";

/**
 * OGP 取得プロキシ（routes/ogp.ts。/api/ogp でマウント）の OpenAPI 登録（#515）。
 */
export function registerOgp(registry: OpenAPIRegistry): void {
  const OgpMetaComponent = registry.register(
    "OgpMeta",
    OgpMetaSchema.openapi({ description: "OGP メタデータ（#515）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/ogp",
    summary: "任意 URL の OGP メタデータを取得する（#515）",
    request: {
      query: z.object({
        url: z
          .string()
          .min(1)
          .max(OGP_URL_MAX_LENGTH)
          .openapi({ param: { name: "url", in: "query" }, description: "OGP を取得する URL（http/https のみ）" }),
      }),
    },
    responses: {
      200: {
        description: "OGP メタデータ（取得失敗・OGP 無し時は各フィールドが null）",
        content: { "application/json": { schema: OgpMetaComponent } },
      },
      400: {
        description: "URL が不正・SSRF リスクあり",
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  });
}
