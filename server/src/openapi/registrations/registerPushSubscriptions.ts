import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { SubscribePushBodySchema, UnsubscribePushBodySchema } from "@hatchery/common";

import type { RegistryContext } from "./shared.js";

/** プッシュ通知購読 API（#798）の OpenAPI 登録。 */
export function registerPushSubscriptions({
  registry,
  ctx,
}: {
  registry: OpenAPIRegistry;
  ctx: RegistryContext;
}): void {
  const { errorJson } = ctx;

  const SubscribePushBodyComponent = registry.register(
    "SubscribePushBody",
    SubscribePushBodySchema.openapi({ description: "Web Push 購読登録リクエスト（#798）" }),
  );

  const UnsubscribePushBodyComponent = registry.register(
    "UnsubscribePushBody",
    UnsubscribePushBodySchema.openapi({ description: "Web Push 購読削除リクエスト（#798）" }),
  );

  registry.registerPath({
    method: "post",
    path: "/api/push-subscriptions",
    summary: "Web Push 購読を登録する（upsert）（#798）",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: SubscribePushBodyComponent } } },
    },
    responses: {
      201: { description: "購読登録完了" },
      400: { description: "リクエスト不正", ...errorJson },
      401: { description: "未認証", ...errorJson },
    },
    tags: ["push-subscriptions"],
  });

  registry.registerPath({
    method: "delete",
    path: "/api/push-subscriptions",
    summary: "Web Push 購読を削除する（#798）",
    security: [{ cookieAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: UnsubscribePushBodyComponent } } },
    },
    responses: {
      204: { description: "購読削除完了" },
      400: { description: "リクエスト不正", ...errorJson },
      401: { description: "未認証", ...errorJson },
    },
    tags: ["push-subscriptions"],
  });
}
