import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  UnreadCountItemSchema,
  UnreadCountsResponseSchema,
  UpdateSubscriptionNotifyEnabledBodySchema,
} from "@hatchery/common";
import { z } from "zod";

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
      401: { description: "未認証", ...errorJson },
    },
    tags: ["subscriptions"],
  });

  registry.registerPath({
    method: "patch",
    path: "/api/communities/{slug}/mark-viewed",
    summary: "コミュニティを既読にする（lastViewedAt を現在時刻に更新）（#933）",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ slug: communitySlugParam }),
    },
    responses: {
      204: { description: "既読に更新した" },
      401: { description: "未認証", ...errorJson },
      403: { description: "権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
    tags: ["communities"],
  });

  const UpdateSubscriptionNotifyEnabledBodyComponent = registry.register(
    "UpdateSubscriptionNotifyEnabledBody",
    UpdateSubscriptionNotifyEnabledBodySchema.openapi({
      description: "コミュニティ単位の通知 ON/OFF 更新リクエストボディ（#1088）",
    }),
  );

  registry.registerPath({
    method: "patch",
    path: "/api/communities/{slug}/subscription",
    summary: "コミュニティ単位の Web Push 通知 ON/OFF を更新する（認証必須・購読済みのみ・#1088）",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ slug: communitySlugParam }),
      body: { content: { "application/json": { schema: UpdateSubscriptionNotifyEnabledBodyComponent } } },
    },
    responses: {
      204: { description: "通知設定を更新した" },
      400: { description: "バリデーションエラー", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "未購読", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
    tags: ["communities"],
  });
}
