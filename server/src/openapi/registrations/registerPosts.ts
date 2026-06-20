import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { CommentViewsRequestSchema, PostViewRequestSchema, VoteRequestSchema } from "@hatchery/common";
import { z } from "zod";

import { type RegistryContext, commentIdParam, postIdParam } from "./shared.js";

/**
 * スレッド取得（post + comments）と post / comment への vote（ADR-0025）の OpenAPI 登録（#535）。
 *
 * Post / Comment component は registerCommunities が ctx に代入済み。これより前に呼ばないこと。
 */
// eslint-disable-next-line max-params
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

  // post 閲覧ビーコン（認証不要・ゲスト対応・#665 / ADR-0032）
  const PostViewRequestComponent = registry.register(
    "PostViewRequest",
    PostViewRequestSchema.openapi({ description: "post 閲覧ビーコン リクエストボディ（#665）" }),
  );

  registry.registerPath({
    method: "post",
    path: "/api/posts/{postId}/view",
    summary: "post 閲覧ビーコンを送信（認証不要・ゲスト対応・#665 / ADR-0032）",
    request: {
      params: z.object({ postId: postIdParam }),
      body: { content: { "application/json": { schema: PostViewRequestComponent } } },
    },
    responses: {
      202: { description: "受理（非同期処理）" },
      404: { description: "投稿が存在しない", ...errorJson },
    },
  });

  // コメント閲覧ビーコン（認証不要・バッチ送信・#665 / ADR-0032）
  const CommentViewsRequestComponent = registry.register(
    "CommentViewsRequest",
    CommentViewsRequestSchema.openapi({ description: "コメント閲覧ビーコン バッチリクエストボディ（#665）" }),
  );

  registry.registerPath({
    method: "post",
    path: "/api/posts/{postId}/comment-views",
    summary: "コメント閲覧ビーコンをバッチ送信（認証不要・ゲスト対応・#665 / ADR-0032）",
    request: {
      params: z.object({ postId: postIdParam }),
      body: { content: { "application/json": { schema: CommentViewsRequestComponent } } },
    },
    responses: {
      202: { description: "受理（非同期処理）" },
      404: { description: "投稿が存在しない", ...errorJson },
    },
  });

  // vote リクエストボディ（ADR-0025: up/down 両対応）
  const VoteRequestComponent = registry.register(
    "VoteRequest",
    VoteRequestSchema.openapi({ description: "vote リクエストボディ（direction: up | down）" }),
  );

  // post への vote（認証不要・ゲスト対応・sessionId dedup・#777）
  registry.registerPath({
    method: "post",
    path: "/api/posts/{postId}/vote",
    summary: "post に up/down vote（認証不要・ゲスト対応・sessionId dedup・toggle/switch・ADR-0025 / #777）",
    request: {
      params: z.object({ postId: postIdParam }),
      body: { content: { "application/json": { schema: VoteRequestComponent } } },
    },
    responses: {
      200: {
        description: "vote 成功。更新後の post（score 加算済み）を返す",
        content: { "application/json": { schema: PostComponent } },
      },
      400: { description: "direction または sessionId が無効", ...errorJson },
      404: { description: "投稿が存在しない", ...errorJson },
    },
  });

  // comment への vote（認証不要・ゲスト対応・sessionId dedup・#777）
  registry.registerPath({
    method: "post",
    path: "/api/comments/{commentId}/vote",
    summary: "comment に up/down vote（認証不要・ゲスト対応・sessionId dedup・toggle/switch・ADR-0025 / #777）",
    request: {
      params: z.object({ commentId: commentIdParam }),
      body: { content: { "application/json": { schema: VoteRequestComponent } } },
    },
    responses: {
      200: {
        description: "vote 成功。更新後の comment（score 加算済み）を返す",
        content: { "application/json": { schema: CommentComponent } },
      },
      400: { description: "direction または sessionId が無効", ...errorJson },
      404: { description: "コメントが存在しない", ...errorJson },
    },
  });
}
