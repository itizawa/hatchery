import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  CreateWorkerSchema,
  SetWorkerCommunitiesSchema,
  UpdateWorkerSchema,
  WORKER_PAGINATION_LIMIT_MAX,
  WorkerCommunityIdsSchema,
  WorkerListQuerySchema,
  WorkerRankingItemSchema,
} from "@hatchery/common";
import { z } from "zod";

import { type RegistryContext, workerPathIdParam } from "./shared.js";

const workerIdParam = z.string().openapi({ param: { name: "workerId", in: "path" } });

/**
 * Worker CRUD（#38 / #329）と admin worker 作成・削除（#217 / #218 / #337）、
 * ワーカーの参加コミュニティ編集（#490）の OpenAPI 登録（#535）。
 */
export function registerWorkers({
  registry,
  ctx,
}: {
  registry: OpenAPIRegistry;
  ctx: RegistryContext;
}): void {
  const { errorJson, WorkerComponent, CommunityComponent, CommentComponent } = ctx;

  const UpdateWorkerComponent = registry.register(
    "UpdateWorker",
    UpdateWorkerSchema.openapi({ description: "Worker 更新リクエストボディ（#38）" }),
  );

  const CreateWorkerComponent = registry.register(
    "CreateWorker",
    CreateWorkerSchema.openapi({ description: "Worker 作成リクエストボディ（#217 / #337）" }),
  );

  const WorkerListQueryComponent = registry.register(
    "WorkerListQuery",
    WorkerListQuerySchema.openapi({ description: "Worker 一覧取得のクエリパラメータ（ページネーション・#545）" }),
  );

  // ワーカーランキング（認証不要・直近 7 日の閲覧数 + 純 vote スコア・#665 / ADR-0032）
  const WorkerRankingItemComponent = registry.register(
    "WorkerRankingItem",
    WorkerRankingItemSchema.openapi({
      description: "ワーカーランキング項目（閲覧数・純 vote スコア・#665）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/workers/ranking",
    summary: "ワーカーランキングを取得（認証不要・直近 7 日・#665 / ADR-0032）",
    responses: {
      200: {
        description: "ワーカーランキング一覧",
        content: {
          "application/json": {
            schema: z.object({
              workers: z.array(WorkerRankingItemComponent),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/workers",
    summary: "Worker 一覧を取得（認証不要・ページネーション対応・#240 / #545）",
    request: {
      query: WorkerListQueryComponent,
    },
    responses: {
      200: {
        description: "Worker 一覧（ページネーション形式・#545）",
        content: {
          "application/json": {
            schema: z.object({
              workers: z.array(WorkerComponent),
              total: z.number().int().min(0),
              page: z.number().int().min(1),
              limit: z.number().int().min(1).max(WORKER_PAGINATION_LIMIT_MAX),
            }),
          },
        },
      },
      400: { description: "バリデーションエラー（page/limit が範囲外）", ...errorJson },
    },
  });

  // ワーカー詳細（認証不要・#929）
  registry.registerPath({
    method: "get",
    path: "/api/workers/{workerId}",
    summary: "ワーカー詳細を取得（認証不要・#929）",
    request: { params: z.object({ workerId: workerIdParam }) },
    responses: {
      200: {
        description: "ワーカー詳細",
        content: { "application/json": { schema: WorkerComponent } },
      },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  // ワーカーの所属コミュニティ一覧（認証不要・#690）
  registry.registerPath({
    method: "get",
    path: "/api/workers/{workerId}/communities",
    summary: "ワーカーの所属コミュニティ一覧を取得（認証不要・#690）",
    request: { params: z.object({ workerId: workerIdParam }) },
    responses: {
      200: {
        description: "ワーカーの所属コミュニティ一覧",
        content: {
          "application/json": {
            schema: z.object({ communities: z.array(CommunityComponent!) }),
          },
        },
      },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  // ワーカーのコメント一覧（認証不要・カーソルページネーション・#690）
  const WorkerCommentsQueryRegistration = registry.register(
    "WorkerCommentsQuery",
    z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().openapi({ param: { name: "limit", in: "query" } }),
      cursor: z.string().optional().openapi({ param: { name: "cursor", in: "query" } }),
    }).openapi({ description: "ワーカーコメント一覧のクエリパラメータ（#690）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/workers/{workerId}/comments",
    summary: "ワーカーのコメント一覧を取得（認証不要・カーソルページネーション・#690）",
    request: {
      params: z.object({ workerId: workerIdParam }),
      query: WorkerCommentsQueryRegistration,
    },
    responses: {
      200: {
        description: "ワーカーのコメント一覧（createdAt 降順・カーソルページネーション）",
        content: {
          "application/json": {
            schema: z.object({
              comments: z.array(CommentComponent!),
              nextCursor: z.string().nullable(),
            }),
          },
        },
      },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  // ワーカーの最新投稿一覧（認証不要・reveal フィルタ適用・#929）
  registry.registerPath({
    method: "get",
    path: "/api/workers/{workerId}/posts",
    summary: "ワーカーの最新投稿一覧を取得（認証不要・reveal フィルタ・#929）",
    request: { params: z.object({ workerId: workerIdParam }) },
    responses: {
      200: {
        description: "ワーカーの投稿一覧（新着順・reveal フィルタ済み）",
        content: {
          "application/json": {
            schema: z.object({ posts: z.array(ctx.PostComponent!) }),
          },
        },
      },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/workers/{id}",
    summary: "Worker を更新（認証必須・admin のみ）",
    request: {
      params: z.object({ id: workerPathIdParam }),
      body: { content: { "application/json": { schema: UpdateWorkerComponent } } },
    },
    responses: {
      200: {
        description: "更新後の Worker",
        content: { "application/json": { schema: WorkerComponent } },
      },
      400: { description: "バリデーションエラー（personality 501 文字超など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  // admin: Worker 作成（#217 / #337）。認証必須・admin のみ。
  registry.registerPath({
    method: "post",
    path: "/api/admin/workers",
    summary: "AI ワーカーを新規作成（認証必須・admin のみ・#217 / #337）",
    request: {
      body: { content: { "application/json": { schema: CreateWorkerComponent } } },
    },
    responses: {
      201: {
        description: "作成された Worker",
        content: { "application/json": { schema: WorkerComponent } },
      },
      400: { description: "バリデーションエラー（displayName 空など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
    },
  });

  // admin: Worker 論理削除（#218 / #337）。認証必須・admin のみ。 deletedAt をセットして返す。
  registry.registerPath({
    method: "delete",
    path: "/api/admin/workers/{id}",
    summary: "Worker を論理削除（認証必須・admin のみ・#218 / #337）",
    request: { params: z.object({ id: workerPathIdParam }) },
    responses: {
      200: {
        description: "論理削除された Worker の id と削除日時（ISO 文字列）",
        content: {
          "application/json": {
            schema: z.object({ id: z.string(), deletedAt: z.string() }),
          },
        },
      },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  // admin: ワーカーの参加コミュニティ編集（#490）。認証必須・admin のみ。
  const WorkerCommunityIdsComponent = registry.register(
    "WorkerCommunityIds",
    WorkerCommunityIdsSchema.openapi({
      description: "ワーカーの参加コミュニティ id 集合（#490）",
    }),
  );

  const SetWorkerCommunitiesComponent = registry.register(
    "SetWorkerCommunities",
    SetWorkerCommunitiesSchema.openapi({
      description: "ワーカーの参加コミュニティを置き換えるリクエストボディ（#490）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/admin/workers/{id}/communities",
    summary: "ワーカーの参加コミュニティ id 一覧を取得（認証必須・admin のみ・#490）",
    request: { params: z.object({ id: workerPathIdParam }) },
    responses: {
      200: {
        description: "参加コミュニティ id 一覧",
        content: { "application/json": { schema: WorkerCommunityIdsComponent } },
      },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/admin/workers/{id}/communities",
    summary: "ワーカーの参加コミュニティを置き換える（認証必須・admin のみ・#490）",
    request: {
      params: z.object({ id: workerPathIdParam }),
      body: { content: { "application/json": { schema: SetWorkerCommunitiesComponent } } },
    },
    responses: {
      200: {
        description: "置換後の参加コミュニティ id 一覧",
        content: { "application/json": { schema: WorkerCommunityIdsComponent } },
      },
      400: { description: "バリデーションエラー / 存在しない communityId", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "Worker が存在しない", ...errorJson },
    },
  });
}
