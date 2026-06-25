import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { UnreadCountsResponseSchema } from "@hatchery/common";

import type { RegistryContext } from "./shared.js";

/**
 * 購読 API（#933: unread-counts）の OpenAPI 登録。
 */
// eslint-disable-next-line max-params
export function registerSubscriptions(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson } = ctx;

  const UnreadCountsResponseComponent = registry.register(
    "UnreadCountsResponse",
    UnreadCountsResponseSchema.openapi({
      description: "購読コミュニティ別の未読数一覧（#933）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/subscriptions/unread-counts",
    summary: "購読コミュニティ別の未読数一覧を取得（認証必須・#933）",
    responses: {
      200: {
        description: "購読コミュニティ別の未読 post 数",
        content: { "application/json": { schema: UnreadCountsResponseComponent } },
      },
      401: { description: "未認証", ...errorJson },
    },
  });
}
