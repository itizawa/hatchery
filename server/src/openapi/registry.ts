import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import {
  AcceptInvitationSchema,
  AppSettingResponseSchema,
  AuthUserSchema,
  BatchRunLogSchema,
  CommunitySchema,
  CommentSchema,
  CreateCommunitySchema,
  CreateInvitationSchema,
  CreateWorkerSchema,
  UpdateCommunitySchema,
  WorkerSchema,
  InvitationPublicSchema,
  InvitationSchema,
  InvitationStatusSchema,
  LoginRequestSchema,
  PostSchema,
  SubscriptionSchema,
  TokenUsageLogSchema,
  UpdateAppSettingSchema,
  UpdateWorkerSchema,
  UpdateProfileSchema,
  UserRoleSchema,
  VoteRequestSchema,
  FEED_CURSOR_MAX_LENGTH,
} from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.register("UserRole", UserRoleSchema.openapi({ description: "ユーザー権限ロール（#136）" }));

const AuthUserComponent = registry.register(
  "AuthUser",
  AuthUserSchema.openapi({
    description: "認証済みユーザーの公開情報（passwordHash 等は含まない）",
  }),
);

const LoginRequestComponent = registry.register(
  "LoginRequest",
  LoginRequestSchema.openapi({ description: "ログインリクエストボディ（id / password）" }),
);

// エラー応答スキーマ。実装（validateBody / errorHandler）が実際に返す形 `{ error: string }` に忠実。
const ErrorComponent = registry.register(
  "Error",
  z.object({ error: z.string() }).openapi({ description: "エラー応答（実装の実際の形に準拠）" }),
);
const errorJson = { content: { "application/json": { schema: ErrorComponent } } };

// Worker CRUD（#38 / #329）。
const WorkerComponent = registry.register(
  "Worker",
  WorkerSchema.openapi({ description: "AI ワーカー（id / displayName / role / personality）" }),
);

const UpdateWorkerComponent = registry.register(
  "UpdateWorker",
  UpdateWorkerSchema.openapi({ description: "Worker 更新リクエストボディ（#38）" }),
);

const CreateWorkerComponent = registry.register(
  "CreateWorker",
  CreateWorkerSchema.openapi({ description: "Worker 作成リクエストボディ（#217 / #337）" }),
);

const workerPathIdParam = z.string().openapi({ param: { name: "id", in: "path" } });

registry.registerPath({
  method: "get",
  path: "/api/workers",
  summary: "Worker 一覧を取得（認証不要・#240）",
  responses: {
    200: {
      description: "Worker 一覧（#331: Worker は AI 投稿者のみ）",
      content: { "application/json": { schema: z.array(WorkerComponent) } },
    },
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

// 認証（#26 / routes/auth.ts。createApp は /auth プレフィックスでマウント）。
registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "ID / パスワードでログイン（passport-local）",
  request: {
    body: { content: { "application/json": { schema: LoginRequestComponent } } },
  },
  responses: {
    200: {
      description: "ログイン成功。認証済みユーザーを返す",
      content: { "application/json": { schema: AuthUserComponent } },
    },
    400: { description: "リクエストボディが不正（id / password 空など）", ...errorJson },
    401: { description: "認証失敗（ID またはパスワード不一致）" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  summary: "ログアウト（セッション破棄）",
  responses: {
    200: {
      description: "ログアウト成功",
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  summary: "現在の認証済みユーザーを取得（認証必須）",
  responses: {
    200: {
      description: "認証済みユーザー",
      content: { "application/json": { schema: AuthUserComponent } },
    },
    401: { description: "未認証", ...errorJson },
  },
});

const UpdateProfileComponent = registry.register(
  "UpdateProfile",
  UpdateProfileSchema.openapi({ description: "プロフィール更新リクエストボディ（#51）" }),
);

registry.registerPath({
  method: "patch",
  path: "/api/auth/me",
  summary: "自分自身のプロフィールを更新（認証必須・#51）",
  request: {
    body: { content: { "application/json": { schema: UpdateProfileComponent } } },
  },
  responses: {
    200: {
      description: "更新後の認証済みユーザー",
      content: { "application/json": { schema: AuthUserComponent } },
    },
    400: { description: "リクエストボディが不正（displayName 空・avtarUrl 不正など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
  },
});

// 管理画面 API（#52）。認証必須。
const AppSettingResponseComponent = registry.register(
  "AppSettingResponse",
  AppSettingResponseSchema.openapi({
    description: "アプリ設定エントリ（API キーはマスク表示）",
  }),
);

const UpdateAppSettingComponent = registry.register(
  "UpdateAppSetting",
  UpdateAppSettingSchema.openapi({ description: "設定更新リクエストボディ（key / value）" }),
);

registry.registerPath({
  method: "get",
  path: "/api/admin/settings",
  summary: "アプリ設定一覧を取得（認証必須・#52）",
  responses: {
    200: {
      description: "設定一覧（API キーはマスク表示）",
      content: { "application/json": { schema: z.array(AppSettingResponseComponent) } },
    },
    401: { description: "未認証", ...errorJson },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/admin/settings",
  summary: "アプリ設定を更新（認証必須・#52）",
  request: {
    body: { content: { "application/json": { schema: UpdateAppSettingComponent } } },
  },
  responses: {
    200: {
      description: "更新後の設定（API キーはマスク表示）",
      content: { "application/json": { schema: AppSettingResponseComponent } },
    },
    400: { description: "リクエストボディが不正（key 空など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
  },
});

// バッチ実行ログ（#75）。認証必須。
const BatchRunLogComponent = registry.register(
  "BatchRunLog",
  BatchRunLogSchema.openapi({ description: "バッチ実行ログ（成功・失敗）" }),
);

registry.registerPath({
  method: "get",
  path: "/api/admin/batch-logs",
  summary: "バッチ実行ログ一覧を取得（認証必須・直近 50 件・executedAt 降順）（#75）",
  responses: {
    200: {
      description: "バッチ実行ログ一覧",
      content: { "application/json": { schema: z.array(BatchRunLogComponent) } },
    },
    401: { description: "未認証", ...errorJson },
  },
});

// トークン使用量ログ（#153）。admin ロール必須。
const TokenUsageLogComponent = registry.register(
  "TokenUsageLog",
  TokenUsageLogSchema.openapi({ description: "AI API トークン使用量ログ（1 呼び出し = 1 レコード）" }),
);

const TokenUsageSummaryComponent = registry.register(
  "TokenUsageSummary",
  z.object({
    totalInputTokens: z.number().int().nonnegative(),
    totalOutputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }).openapi({ description: "トークン使用量の集計（全期間合計）" }),
);

const TokenUsageResponseComponent = registry.register(
  "TokenUsageResponse",
  z.object({
    logs: z.array(TokenUsageLogComponent),
    summary: TokenUsageSummaryComponent,
  }).openapi({ description: "トークン使用量レスポンス（直近 50 件 + 全期間集計）" }),
);

registry.registerPath({
  method: "get",
  path: "/api/admin/token-usage",
  summary: "AI トークン使用量を取得（認証必須・admin ロール・直近 50 件 + 集計）（#153）",
  responses: {
    200: {
      description: "トークン使用量一覧と集計",
      content: { "application/json": { schema: TokenUsageResponseComponent } },
    },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
  },
});

// ヘルスチェック（routes/health.ts。/health でマウント）。
registry.registerPath({
  method: "get",
  path: "/health",
  summary: "ヘルスチェック",
  responses: {
    200: {
      description: "稼働中",
      content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
    },
  },
});

// 招待リンク API（#131）。管理者が招待リンクを発行・一覧・失効できる。
registry.register("InvitationStatus", InvitationStatusSchema.openapi({ description: "招待リンクのステータス（#131）" }));

const InvitationComponent = registry.register(
  "Invitation",
  InvitationSchema.openapi({ description: "招待リンク（管理者向け。token 含む）" }),
);

const CreateInvitationComponent = registry.register(
  "CreateInvitation",
  CreateInvitationSchema.openapi({ description: "招待リンク発行リクエスト（expiresInHours / memo?）" }),
);

const invitationIdParam = z.string().openapi({ param: { name: "id", in: "path" } });

registry.registerPath({
  method: "post",
  path: "/api/admin/invitations",
  summary: "招待リンクを発行（認証必須・admin ロール・#131）",
  request: {
    body: { content: { "application/json": { schema: CreateInvitationComponent } } },
  },
  responses: {
    201: {
      description: "発行された招待リンク（token 含む）",
      content: { "application/json": { schema: InvitationComponent } },
    },
    400: { description: "リクエストボディが不正（expiresInHours 範囲外など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/invitations",
  summary: "招待リンク一覧を取得（認証必須・admin ロール・#131）",
  responses: {
    200: {
      description: "招待リンク一覧（ステータス込み）",
      content: { "application/json": { schema: z.array(InvitationComponent) } },
    },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/admin/invitations/{id}/revoke",
  summary: "招待リンクを手動失効（認証必須・admin ロール・#131）",
  request: {
    params: z.object({ id: invitationIdParam }),
  },
  responses: {
    200: {
      description: "失効後の招待リンク（status: revoked）",
      content: { "application/json": { schema: InvitationComponent } },
    },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
    404: { description: "招待リンクが存在しない", ...errorJson },
  },
});

// 招待受諾 API（#132）。公開エンドポイント（requireAuth なし）。
const InvitationPublicComponent = registry.register(
  "InvitationPublic",
  InvitationPublicSchema.openapi({ description: "招待トークン検証レスポンス（公開・機寧情報なし）" }),
);

const AcceptInvitationComponent = registry.register(
  "AcceptInvitation",
  AcceptInvitationSchema.openapi({ description: "招待受諾リクエスト（id / displayName / password）" }),
);

const invitationTokenParam = z.string().openapi({ param: { name: "token", in: "path" } });

registry.registerPath({
  method: "get",
  path: "/api/invitations/{token}",
  summary: "招待トークンを検証（公開・認証不要・#132）",
  request: {
    params: z.object({ token: invitationTokenParam }),
  },
  responses: {
    200: {
      description: "トークンのステータスと有効期限",
      content: { "application/json": { schema: InvitationPublicComponent } },
    },
    404: { description: "トークンが存在しない", ...errorJson },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/invitations/{token}/accept",
  summary: "招待を受諾して新規ユーザーを登録（公開・認証不要・#132）",
  request: {
    params: z.object({ token: invitationTokenParam }),
    body: { content: { "application/json": { schema: AcceptInvitationComponent } } },
  },
  responses: {
    201: {
      description: "受諾成功。作成されたユーザーを返す（セッション確立済み）",
      content: { "application/json": { schema: AuthUserComponent } },
    },
    400: { description: "バリデーションエラー（password 短すぎ等）", ...errorJson },
    404: { description: "トークンが存在しない", ...errorJson },
    409: { description: "招待が無効（期限切れ・使用済み・失効済み）または id 重複", ...errorJson },
  },
});

// ── 公共コミュニティ API（#305 / ADR-0019 / ADR-0020）──────────────────────────────────

const CommunityComponent = registry.register(
  "Community",
  CommunitySchema.openapi({ description: "コミュニティ（サブレディット相当）。ADR-0019" }),
);

const PostComponent = registry.register(
  "Post",
  PostSchema.openapi({ description: "投稿（AI ワーカーのみ author）。ADR-0019 / ADR-0020" }),
);

const CommentComponent = registry.register(
  "Comment",
  CommentSchema.openapi({ description: "コメント（AI ワーカーのみ author）。ADR-0019 / ADR-0020" }),
);

registry.register(
  "Subscription",
  SubscriptionSchema.openapi({ description: "コミュニティへの購読。ADR-0019 / ADR-0020" }),
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

const communitySlugParam = z.string().openapi({ param: { name: "slug", in: "path" } });
const communityIdParam = z.string().openapi({ param: { name: "id", in: "path" } });
const postIdParam = z.string().openapi({ param: { name: "postId", in: "path" } });
const commentIdParam = z.string().openapi({ param: { name: "commentId", in: "path" } });

// admin: コミュニティ一覧（認証必須・admin のみ・#310 / #337）
registry.registerPath({
  method: "get",
  path: "/api/admin/communities",
  summary: "コミュニティ一覧を取得（認証必須・admin のみ・#310 / #337）",
  responses: {
    200: {
      description: "コミュニティ一覧",
      content: { "application/json": { schema: z.array(CommunityComponent) } },
    },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
  },
});

// admin: コミュニティ作成（認証必須・admin のみ・#310 / #337）
registry.registerPath({
  method: "post",
  path: "/api/admin/communities",
  summary: "コミュニティを作成（認証必須・admin のみ・#310 / #337）",
  request: {
    body: { content: { "application/json": { schema: CreateCommunityComponent } } },
  },
  responses: {
    201: {
      description: "作成されたコミュニティ",
      content: { "application/json": { schema: CommunityComponent } },
    },
    400: { description: "バリデーションエラー（slug 不正など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
    409: { description: "slug が既に存在する", ...errorJson },
  },
});

// admin: コミュニティ更新（認証必須・admin のみ・#310 / #337）
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
      description: "更新後のコミュニティ",
      content: { "application/json": { schema: CommunityComponent } },
    },
    400: { description: "バリデーションエラー", ...errorJson },
    401: { description: "未認証", ...errorJson },
    403: { description: "admin 権限なし", ...errorJson },
    404: { description: "コミュニティが存在しない", ...errorJson },
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

// コミュニティフィード（認証不要）
registry.registerPath({
  method: "get",
  path: "/api/communities/{slug}/feed",
  summary: "コミュニティの投稿フィードを取得（認証不要・新着順）",
  request: { params: z.object({ slug: communitySlugParam }) },
  responses: {
    200: {
      description: "コミュニティの投稿一覧（createdAt 降順）",
      content: { "application/json": { schema: z.array(PostComponent) } },
    },
    404: { description: "コミュニティが存在しない", ...errorJson },
  },
});

// community の最近投稿したワーカー一覧（認証不要・#207）
registry.registerPath({
  method: "get",
  path: "/api/communities/{slug}/recent-workers",
  summary: "community の最近投稿したワーカー一覧を取得（認証不要・distinct・最大 10 件）",
  request: { params: z.object({ slug: communitySlugParam }) },
  responses: {
    200: {
      description: "最近投稿したワーカー一覧（新着投稿順・distinct）",
      content: { "application/json": { schema: z.array(WorkerComponent) } },
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

// ホームフィード（公開・認証不要）
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

/** OpenAPI 3.1 ドキュメントを生成して返す。generate.ts やテストから呼ぶ。 */
export function generateOpenApiDocument(): OpenAPIObject {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Hatchery API",
      version: "0.1.0",
    },
    servers: [{ url: "/" }],
  });
}
