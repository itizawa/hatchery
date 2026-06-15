import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { VoteRequestSchema } from "@hatchery/common";
import { z } from "zod";

import { type RegistryContext, commentIdParam, postIdParam } from "./shared.js";

/**
 * スレッド取得（post + comments）と post / comment への vote（ADR-0025）の OpenAPI 登録（#535）。
 *
 * Post / Comment component は registerCommunities が ctx に代入済み。これより前に呼ばないこと。
 */
export function registerPosts(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson, PostComponent, CommentComponent } = ctx;
  if (!PostComponent || !CommentComponent) {
    throw new Error(
      "registerPosts は registerCommunities の後に呼ぶ必要があります（Post / Comment component 未登録）",
    );
  }

  // スレッド取得（post + comments）
  registry.registerPath({
    method: "get",
    path: "/api/posts/{postId}",
    summary: "スレッドを取得（post + comments・認証不要）",
    request: { params: z.object({ postId: postIdParam }) },
    responses: {
      200: {
        description: "post と comments の一覧",
        content: {
          "application/json": {
            schema: z.object({
              post: PostComponent,
              comments: z.array(CommentComponent),
            }),
          },
        },
      },
      404: { description: "投稿が存在しない", ...errorJson },
    },
  });

  // vote リクエストボディ（ADR-0025: up/down 両対応）
  const VoteRequestComponent = registry.register(
    "VoteRequest",
    VoteRequestSchema.openapi({ description: "vote リクエストボディ（direction: up | down）" }),
  );

  // post への vote（認証必須・toggle/switch・ADR-0025）
  registry.registerPath({
    method: "post",
    path: "/api/posts/{postId}/vote",
    summary: "post に up/down vote（認証必須・toggle/switch・ADR-0025）",
    request: {
      params: z.object({ postId: postIdParam }),
      body: { content: { "application/json": { schema: VoteRequestComponent } } },
    },
    responses: {
      200: {
        description: "vote 成功。更新後の post（score 加算済み）を返す",
        content: { "application/json": { schema: PostComponent } },
      },
      400: { description: "direction が無効", ...errorJson },
      401: { description: "未認証", ...errorJson },
      404: { description: "投稿が存在しない", ...errorJson },
    },
  });

  // comment への vote（認証必須・toggle/switch・ADR-0025）
  registry.registerPath({
    method: "post",
    path: "/api/comments/{commentId}/vote",
    summary: "comment に up/down vote（認証必須・toggle/switch・ADR-0025）",
    request: {
      params: z.object({ commentId: commentIdParam }),
      body: { content: { "application/json": { schema: VoteRequestComponent } } },
    },
    responses: {
      200: {
        description: "vote 成功。更新後の comment（score 加算済み）を返す",
        content: { "application/json": { schema: CommentComponent } },
      },
      400: { description: "direction が無効", ...errorJson },
      401: { description: "未認証", ...errorJson },
      404: { description: "コメントが存在しない", ...errorJson },
    },
  });
}
