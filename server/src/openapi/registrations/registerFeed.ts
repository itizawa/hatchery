import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { FEED_CURSOR_MAX_LENGTH } from "@hatchery/common";
import { z } from "zod";

import type { RegistryContext } from "./shared.js";

/**
 * ホームフィード（公開・認証不要・カーソルページネーション #367）の OpenAPI 登録（#535）。
 *
 * Post component は registerCommunities が ctx に代入済み。これより前に呼ばないこと。
 */
export function registerFeed({
  registry,
  ctx,
}: {
  registry: OpenAPIRegistry;
  ctx: RegistryContext;
}): void {
  const { errorJson, PostComponent } = ctx;
  if (!PostComponent) {
    throw new Error("registerFeed は registerCommunities の後に呼ぶ必要があります（Post component 未登録）");
  }

  registry.registerPath({
    method: "get",
    path: "/api/feed",
    summary: "ホームフィードを取得（認証不要・全 community の投稿・新着順・カーソルページネーション #367）",
    request: {
      query: z.object({
        cursor: z
          .string()
          .max(FEED_CURSOR_MAX_LENGTH)
          .optional()
          .openapi({ description: "カーソル（直前ページ末尾位置の base64 エンコード）" }),
        limit: z
          .coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .openapi({ description: "1 ページあたりの件数（1～100、既定 20）" }),
        sort: z
          .enum(["latest", "popular"])
          .default("latest")
          .openapi({ description: "並び順（latest=新着順 / popular=vote 数降順、既定 latest）" }),
        sessionId: z
          .string()
          .uuid()
          .optional()
          .openapi({ description: "セッション ID（付与すると各 post に my_vote を付与・#831）" }),
      }),
    },
    responses: {
      200: {
        description: "全 community の投稿一覧（createdAt 降順）とカーソル情報",
        content: {
          "application/json": {
            schema: z.object({
              posts: z.array(PostComponent),
              nextCursor: z
                .string()
                .max(FEED_CURSOR_MAX_LENGTH)
                .nullable()
                .openapi({ description: "次ページ取得用カーソル。null の場合は末尾" }),
            }),
          },
        },
      },
      400: { description: "クエリパラメータが不正（limit 超過・不正 cursor）", ...errorJson },
    },
  });
}
