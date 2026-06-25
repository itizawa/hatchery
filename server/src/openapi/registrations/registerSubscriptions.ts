import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { UnreadCountItemSchema, UnreadCountsResponseSchema } from "@hatchery/common";

import type { RegistryContext } from "./shared.js";
import { communitySlugParam } from "./shared.js";

/** 購読 API（#933）の OpenAPI 登録。 */
// eslint-disable-next-line max-params
export function registerSubscriptions(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson } = ctx;

  registry.register(
    "UnreadCountItem",
    UnreadCountItemSchema.openapi({
      description: "購読コミュニティの未読数アイテム（#933）",
    }),
  );

  const UnreadCountsResponseComponent = registry.register(
    "UnreadCountsResponse",
    UnreadCountsResponseSchema.openapi({
      description: "購読コミュニティ別未読数レスポンス（#933）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/subscriptions/unread-counts",
    summary: "購読コミュニティ別の未読数を取得する（#933）",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "未読数一覧",
        content: { "application/json": { schema: UnreadCountsResponseComponent } },
      },
      401: errorJson,
    },
    tags: ["subscriptions"],
  });

  registry.registerPath({
    method: "patch",
    path: "/api/communities/{slug}/mark-viewed",
    summary: "コミュニティを既読にする（lastViewedAt を現在時刻に更新）（#933）",
    security: [{ cookieAuth: [] }],
    request: {
      params: communitySlugParam,
    },
    responses: {
      204: { description: "既読に更新した" },
      401: errorJson,
      403: errorJson,
      404: errorJson,
    },
    tags: ["communities"],
  });
}
