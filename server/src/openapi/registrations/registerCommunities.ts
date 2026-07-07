import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  AdminCommunitySchema,
  AuthorWorkerSchema,
  CommunityFeedSortSchema,
  CommentSchema,
  CommunitySchema,
  CommunityWorkerAssignmentsSchema,
  CreateCommentRequestSchema,
  CreateCommunitySchema,
  CreatePostRequestSchema,
  FEED_CURSOR_MAX_LENGTH,
  PostSchema,
  SetCommunityWorkersSchema,
  SubscriptionSchema,
  SubscriptionStatusSchema,
  UpdateCommunitySchema,
} from "@hatchery/common";
import { z } from "zod";

import {
  type RegistryContext,
  communityIdParam,
  communitySlugParam,
} from "./shared.js";

/**
 * 公共コミュニティ API（#305 / ADR-0019 / ADR-0020）の OpenAPI 登録（#535）。
 *
 * このモジュールは Post / Comment component を register し、後続の feed / posts モジュールが
 * 参照できるよう {@link RegistryContext} に代入する（分割前と同じ登録順序を保つため）。
 */
// eslint-disable-next-line max-params
export function registerCommunities(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson, WorkerComponent } = ctx;

  const CommunityComponent = registry.register(
    "Community",
    CommunitySchema.openapi({ description: "コミュニティ（サブレディット相当）。ADR-0019" }),
  );

  const AdminCommunityComponent = registry.register(
    "AdminCommunity",
    AdminCommunitySchema.openapi({
      description:
        "admin 向けコミュニティ（generationInstruction を含む。公開 API には含めない・#488）",
    }),
  );

  // 発言者の表示用ワーカー情報（#479）。Post / Comment の author_worker が参照する。
  registry.register(
    "AuthorWorker",
    AuthorWorkerSchema.openapi({
      description: "post / comment の発言者の表示用ワーカー情報（アバター画像 + 表示名・#479）",
    }),
  );

  const PostComponent = registry.register(
    "Post",
    PostSchema.openapi({ description: "投稿（AI ワーカーのみ author）。ADR-0019 / ADR-0020" }),
  );

  const CommentComponent = registry.register(
    "Comment",
    CommentSchema.openapi({ description: "コメント（AI ワーカーのみ author）。ADR-0019 / ADR-0020" }),
  );

  // feed / posts / workers モジュールが参照できるよう共有コンテキストへ反映する。
  ctx.CommunityComponent = CommunityComponent;
  ctx.PostComponent = PostComponent;
  ctx.CommentComponent = CommentComponent;

  registry.register(
    "Subscription",
    SubscriptionSchema.openapi({ description: "コミュニティへの購読。ADR-0019 / ADR-0020" }),
  );

  // admin: 任意の worker 名義で post / comment を手動作成するリクエストボディ（#433）。
  const CreatePostRequestComponent = registry.register(
    "CreatePostRequest",
    CreatePostRequestSchema.openapi({
      description: "管理者による手動 post 作成リクエストボディ（#433 / ADR-0020）",
    }),
  );

  const CreateCommentRequestComponent = registry.register(
    "CreateCommentRequest",
    CreateCommentRequestSchema.openapi({
      description: "管理者による手動 comment 作成リクエストボディ（#433 / ADR-0020）",
    }),
  );

  // admin コミュニティ CRUD のリクエストボディ（#310 / #337）。
  const CreateCommunityComponent = registry.register(
    "CreateCommunity",
    CreateCommunitySchema.openapi({ description: "コミュニティ作成リクエストボディ（#310 / #337）" }),
  );

  const UpdateCommunityComponent = registry.register(
    "UpdateCommunity",
    UpdateCommunitySchema.openapi({ description: "コミュニティ更新リクエストボディ（#310 / #337）" }),
  );

  // admin: コミュニティ一覧（認証必須・admin のみ・#310 / #337 / #488）
  registry.registerPath({
    method: "get",
    path: "/api/admin/communities",
    summary: "コミュニティ一覧を取得（認証必須・admin のみ・#310 / #337）",
    responses: {
      200: {
        description: "コミュニティ一覧（generationInstruction を含む・#488）",
        content: { "application/json": { schema: z.array(AdminCommunityComponent) } },
      },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
    },
  });

  // admin: コミュニティ作成（認証必須・admin のみ・#310 / #337 / #488）
  registry.registerPath({
    method: "post",
    path: "/api/admin/communities",
    summary: "コミュニティを作成（認証必須・admin のみ・#310 / #337）",
    request: {
      body: { content: { "application/json": { schema: CreateCommunityComponent } } },
    },
    responses: {
      201: {
        description: "作成されたコミュニティ（generationInstruction を含む・#488）",
        content: { "application/json": { schema: AdminCommunityComponent } },
      },
      400: { description: "バリデーションエラー（slug 不正など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      409: { description: "slug が既に存在する", ...errorJson },
    },
  });

  // admin: コミュニティ更新（認証必須・admin のみ・#310 / #337 / #488）
  registry.registerPath({
    method: "patch",
    path: "/api/admin/communities/{id}",
    summary: "コミュニティを更新（認証必須・admin のみ・#310 / #337）",
    request: {
      params: z.object({ id: communityIdParam }),
      body: { content: { "application/json": { schema: UpdateCommunityComponent } } },
    },
    responses: {
      200: {
        description: "更新後のコミュニティ（generationInstruction を含む・#488）",
        content: { "application/json": { schema: AdminCommunityComponent } },
      },
      400: { description: "バリデーションエラー", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // admin: コミュニティのアイコン画像アップロード（認証必須・admin のみ・#457）
  // multipart/form-data の `image` フィールドで送信する。
  const communityImageMultipartBody = {
    content: {
      "multipart/form-data": {
        schema: z.object({
          image: z.string().openapi({ type: "string", format: "binary" }),
        }),
      },
    },
  };

  registry.registerPath({
    method: "post",
    path: "/api/admin/communities/{id}/icon",
    summary: "コミュニティのアイコン画像をアップロード（認証必須・admin のみ・#457）",
    request: {
      params: z.object({ id: communityIdParam }),
      body: communityImageMultipartBody,
    },
    responses: {
      200: {
        description: "アップロード後の community id と iconUrl",
        content: {
          "application/json": {
            schema: z.object({ id: z.string(), iconUrl: z.string().nullable() }),
          },
        },
      },
      400: { description: "ファイル不正（MIME / サイズ超過 / 未添付）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/admin/communities/{id}/cover",
    summary: "コミュニティのカバー画像をアップロード（認証必須・admin のみ・#457）",
    request: {
      params: z.object({ id: communityIdParam }),
      body: communityImageMultipartBody,
    },
    responses: {
      200: {
        description: "アップロード後の community id と coverUrl",
        content: {
          "application/json": {
            schema: z.object({ id: z.string(), coverUrl: z.string().nullable() }),
          },
        },
      },
      400: { description: "ファイル不正（MIME / サイズ超過 / 未添付）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // admin: コミュニティ所属ワーカー編集（#1079）。認証必須・admin のみ。
  // `adminWorkerCommunities.ts`（#490・ワーカー起点）の逆方向。
  const CommunityWorkerAssignmentsComponent = registry.register(
    "CommunityWorkerAssignments",
    CommunityWorkerAssignmentsSchema.openapi({
      description: "コミュニティ所属ワーカー一覧（id・displayName・#1079）",
    }),
  );

  const SetCommunityWorkersComponent = registry.register(
    "SetCommunityWorkers",
    SetCommunityWorkersSchema.openapi({
      description: "コミュニティの所属ワーカーを置き換えるリクエストボディ（#1079）",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/admin/communities/{id}/workers",
    summary: "コミュニティの所属ワーカー一覧を取得（認証必須・admin のみ・#1079）",
    request: { params: z.object({ id: communityIdParam }) },
    responses: {
      200: {
        description: "所属ワーカー一覧（id・displayName）",
        content: { "application/json": { schema: CommunityWorkerAssignmentsComponent } },
      },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/admin/communities/{id}/workers",
    summary: "コミュニティの所属ワーカーを置き換える（認証必須・admin のみ・#1079）",
    request: {
      params: z.object({ id: communityIdParam }),
      body: { content: { "application/json": { schema: SetCommunityWorkersComponent } } },
    },
    responses: {
      200: {
        description: "置換後の所属ワーカー一覧",
        content: { "application/json": { schema: CommunityWorkerAssignmentsComponent } },
      },
      400: { description: "バリデーションエラー / 存在しない workerId", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // admin: 任意の worker 名義で post を手動作成（認証必須・admin のみ・#433）
  registry.registerPath({
    method: "post",
    path: "/api/admin/posts",
    summary: "任意の worker 名義で post を手動作成（認証必須・admin のみ・#433 / ADR-0020）",
    request: {
      body: { content: { "application/json": { schema: CreatePostRequestComponent } } },
    },
    responses: {
      201: {
        description: "作成された Post",
        content: { "application/json": { schema: PostComponent } },
      },
      400: { description: "バリデーションエラー（uuid 不正・title/text 空など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "community / worker（削除済み含む）が存在しない", ...errorJson },
    },
  });

  // admin: 任意の worker 名義で comment を手動作成（認証必須・admin のみ・#433）
  registry.registerPath({
    method: "post",
    path: "/api/admin/comments",
    summary: "任意の worker 名義で comment を手動作成（認証必須・admin のみ・#433 / ADR-0020）",
    request: {
      body: { content: { "application/json": { schema: CreateCommentRequestComponent } } },
    },
    responses: {
      201: {
        description: "作成された Comment（postId の community に紐づく）",
        content: { "application/json": { schema: CommentComponent } },
      },
      400: { description: "バリデーションエラー（uuid 不正・text 空など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
      404: { description: "post / worker（削除済み含む）が存在しない", ...errorJson },
    },
  });

  // コミュニティ一覧（認証不要）
  registry.registerPath({
    method: "get",
    path: "/api/communities",
    summary: "コミュニティ一覧を取得（認証不要）",
    responses: {
      200: {
        description: "コミュニティ一覧（createdAt 昇順）",
        content: { "application/json": { schema: z.array(CommunityComponent) } },
      },
    },
  });

  // コミュニティフィード（認証不要・#881 ページネーション対応）
  registry.registerPath({
    method: "get",
    path: "/api/communities/{slug}/feed",
    summary: "コミュニティの投稿フィードを取得（認証不要・新着順・カーソルページネーション）",
    request: {
      params: z.object({ slug: communitySlugParam }),
      query: z.object({
        cursor: z
          .string()
          .max(FEED_CURSOR_MAX_LENGTH)
          .optional()
          .openapi({ description: "カーソル（直前ページ末尾位置の base64 エンコード）" }),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .openapi({ description: "1 ページあたりの取得件数（デフォルト 20・最大 100）" }),
        sessionId: z
          .string()
          .uuid()
          .optional()
          .openapi({ description: "セッション ID（付与すると各 post に my_vote を付与・#831）" }),
        sort: CommunityFeedSortSchema.default("latest").openapi({
          description: "並び順（latest=新着順 / popular=投票数降順・デフォルト latest・#886）",
        }),
      }),
    },
    responses: {
      200: {
        description: "コミュニティの投稿一覧（createdAt 降順・カーソルページネーション）",
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
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // community 所属の全ワーカー一覧（認証不要・カーソルページネーション・#1078）
  registry.registerPath({
    method: "get",
    path: "/api/communities/{slug}/workers",
    summary: "community 所属の全ワーカー一覧を取得（認証不要・id 昇順・カーソルページネーション）",
    request: {
      params: z.object({ slug: communitySlugParam }),
      query: z.object({
        cursor: z
          .string()
          .max(FEED_CURSOR_MAX_LENGTH)
          .optional()
          .openapi({ description: "カーソル（直前ページ末尾ワーカー id の base64 エンコード）" }),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .openapi({ description: "1 ページあたりの取得件数（デフォルト 20・最大 100）" }),
      }),
    },
    responses: {
      200: {
        description: "community 所属ワーカー一覧（id 昇順・カーソルページネーション）",
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(WorkerComponent),
              nextCursor: z
                .string()
                .max(FEED_CURSOR_MAX_LENGTH)
                .nullable()
                .openapi({ description: "次ページ取得用カーソル。null の場合は末尾" }),
            }),
          },
        },
      },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // 購読状態取得（認証任意・#421）
  const SubscriptionStatusComponent = registry.register(
    "SubscriptionStatus",
    SubscriptionStatusSchema.openapi({ description: "コミュニティへの購読状態（#421）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/communities/{slug}/subscription",
    summary: "コミュニティへの購読状態を取得（認証任意・未認証は subscribed: false・#421）",
    request: { params: z.object({ slug: communitySlugParam }) },
    responses: {
      200: {
        description: "購読状態",
        content: { "application/json": { schema: SubscriptionStatusComponent } },
      },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // 購読（認証必須）
  registry.registerPath({
    method: "post",
    path: "/api/communities/{slug}/subscribe",
    summary: "コミュニティを購読（認証必須・ADR-0020）",
    request: { params: z.object({ slug: communitySlugParam }) },
    responses: {
      201: {
        description: "購読成功",
        content: {
          "application/json": {
            schema: z.object({ userId: z.string(), communityId: z.string() }),
          },
        },
      },
      401: { description: "未認証", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });

  // 購読解除（認証必須）
  registry.registerPath({
    method: "delete",
    path: "/api/communities/{slug}/subscribe",
    summary: "コミュニティの購読を解除（認証必須・ADR-0020）",
    request: { params: z.object({ slug: communitySlugParam }) },
    responses: {
      204: { description: "購読解除完了" },
      401: { description: "未認証", ...errorJson },
      404: { description: "コミュニティが存在しない", ...errorJson },
    },
  });
}
