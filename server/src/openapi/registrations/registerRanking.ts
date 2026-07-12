import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { TrendingItemSchema } from "@hatchery/common";
import { z } from "zod";

import type { RegistryContext } from "./shared.js";

/** GET /api/ranking/trending の limit クエリの最大値（#1065）。 */
const TRENDING_QUERY_MAX_LIMIT = 20;

/**
 * ランキング画面右サイドバー用のトレンド Post/Comment（認証不要・直近 7 日・#1065）の OpenAPI 登録。
 */
export function registerRanking({
  registry,
  ctx,
}: {
  registry: OpenAPIRegistry;
  ctx: RegistryContext;
}): void {
  const { errorJson } = ctx;

  const TrendingItemComponent = registry.register(
    "TrendingItem",
    TrendingItemSchema.openapi({
      description: "直近 7 日間で評価（vote）を多く獲得した Post / Comment（#1065）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/ranking/trending",
    summary: "直近 7 日間で評価（vote）を多く獲得した Post / Comment を取得（認証不要・#1065）",
    request: {
      query: z.object({
        limit: z
          .coerce
          .number()
          .int()
          .min(1)
          .max(TRENDING_QUERY_MAX_LIMIT)
          .optional()
          .openapi({ description: `取得件数（1〜${TRENDING_QUERY_MAX_LIMIT}、既定 10）` }),
      }),
    },
    responses: {
      200: {
        description: "トレンド Post/Comment 一覧（net_score 降順）",
        content: {
          "application/json": {
            schema: z.object({ items: z.array(TrendingItemComponent) }),
          },
        },
      },
      400: { description: "バリデーションエラー（limit 範囲外）", ...errorJson },
    },
  });
}
