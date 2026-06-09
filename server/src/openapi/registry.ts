import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import {
  AcceptInvitationSchema,
  AddChannelMemberSchema,
  AppSettingResponseSchema,
  AuthUserSchema,
  BatchRunLogSchema,
  ChannelGoalSchema,
  ChannelSchema,
  CreateChannelMessageSchema,
  CreateChannelSchema,
  CreateInvitationSchema,
  EmployeeSchema,
  InvitationPublicSchema,
  InvitationSchema,
  InvitationStatusSchema,
  LoginRequestSchema,
  MessageRecordSchema,
  MessageSchema,
  TokenUsageLogSchema,
  UpdateAppSettingSchema,
  UpdateChannelSchema,
  UpdateEmployeeSchema,
  UpdateProfileSchema,
  UserRoleSchema,
} from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const MessageComponent = registry.register(
  "Message",
  MessageSchema.openapi({ description: "channel に直接紐づく社員の 1 発言（ADR-0009）" }),
);

const MessageRecordComponent = registry.register(
  "MessageRecord",
  MessageRecordSchema.openapi({ description: "永続化された発言（id / createdAt / order 付き）" }),
);

const CreateChannelMessageComponent = registry.register(
  "CreateChannelMessage",
  CreateChannelMessageSchema.openapi({
    description: "ユーザーがチャンネルへメッセージを投稿するリクエストボディ（#48）",
  }),
);

registry.register(
  "ChannelGoal",
  ChannelGoalSchema.openapi({ description: "チャンネルの AI 出力契約（#284 / ADR-0016）" }),
);

const ChannelComponent = registry.register(
  "Channel",
  ChannelSchema.openapi({ description: "チャンネル（id / label / goal）" }),
);

const UpdateChannelComponent = registry.register(
  "UpdateChannel",
  UpdateChannelSchema.openapi({ description: "チャンネル名更新リクエストボディ（#37）" }),
);

const CreateChannelComponent = registry.register(
  "CreateChannel",
  CreateChannelSchema.openapi({ description: "チャンネル作成リクエストボディ（#47・label のみ）" }),
);

const AddChannelMemberComponent = registry.register(
  "AddChannelMember",
  AddChannelMemberSchema.openapi({
    description: "チャンネルへ Employee を追加するリクエストボディ（#33）",
  }),
);

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

registry.registerPath({
  method: "get",
  path: "/api/messages",
  summary: "メッセージ一覧を取得",
  responses: {
    200: {
      description: "メッセージ一覧",
      content: {
        "application/json": {
          schema: z.array(MessageComponent),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/messages",
  summary: "メッセージを一括作成",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.array(MessageComponent).min(1),
        },
      },
    },
  },
  responses: {
    201: {
      description: "作成されたメッセージ一覧",
      content: {
        "application/json": {
          schema: z.array(MessageComponent),
        },
      },
    },
  },
});

// Employee CRUD（#38）。
const EmployeeComponent = registry.register(
  "Employee",
  EmployeeSchema.openapi({ description: "AI 社員（id / displayName / role / isBot / personality）" }),
);

const UpdateEmployeeComponent = registry.register(
  "UpdateEmployee",
  UpdateEmployeeSchema.openapi({ description: "Employee 更新リクエストボディ（#38）" }),
);

const employeePathIdParam = z.string().openapi({ param: { name: "id", in: "path" } });

registry.registerPath({
  method: "get",
  path: "/api/employees",
  summary: "Bot Employee 一覧を取得（認証不要・#240）",
  responses: {
    200: {
      description: "isBot=true の Employee 一覧",
      content: { "application/json": { schema: z.array(EmployeeComponent) } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/employees/{id}",
  summary: "自分の Employee を更新（認証必須・本人のみ）",
  request: {
    params: z.object({ id: employeePathIdParam }),
    body: { content: { "application/json": { schema: UpdateEmployeeComponent } } },
  },
  responses: {
    200: {
      description: "更新後の Employee",
      content: { "application/json": { schema: EmployeeComponent } },
    },
    400: { description: "バリデーションエラー（personality 501 文字超など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
    403: { description: "他ユーザーの Employee への操作禁止", ...errorJson },
    404: { description: "Employee が存在しない", ...errorJson },
  },
});

// チャンネル CRUD（#37 / #47）。
const channelIdParam = z.string().openapi({ param: { name: "channelId", in: "path" } });
const employeeIdParam = z.string().openapi({ param: { name: "employeeId", in: "path" } });
const channelPathIdParam = z.string().openapi({ param: { name: "id", in: "path" } });

registry.registerPath({
  method: "get",
  path: "/api/channels",
  summary: "チャンネル一覧を取得（認証不要・#47）",
  responses: {
    200: {
      description: "チャンネル一覧",
      content: { "application/json": { schema: z.array(ChannelComponent) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/channels",
  summary: "チャンネルを作成（認証必須・#47）",
  request: {
    body: { content: { "application/json": { schema: CreateChannelComponent } } },
  },
  responses: {
    201: {
      description: "作成されたチャンネル",
      content: { "application/json": { schema: ChannelComponent } },
    },
    400: { description: "リクエストボディが不正（label 空など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/channels/{id}",
  summary: "チャンネル名を更新（認証必須）",
  request: {
    params: z.object({ id: channelPathIdParam }),
    body: {
      content: { "application/json": { schema: UpdateChannelComponent } },
    },
  },
  responses: {
    200: {
      description: "更新後のチャンネル情報",
      content: { "application/json": { schema: ChannelComponent } },
    },
    400: { description: "リクエストボディが不正（label 空など）", ...errorJson },
    401: { description: "未認証", ...errorJson },
    404: { description: "チャンネルが存在しない", ...errorJson },
  },
});

// チャンネル別メッセージ（#48）。
registry.registerPath({
  method: "get",
  path: "/api/channels/{channelId}/messages",
  summary: "チャンネル別メッセージ一覧を取得（認証不要・#48）",
  request: { params: z.object({ channelId: channelIdParam }) },
  responses: {
    200: {
      description: "チャンネルのメッセージ一覧",
      content: { "application/json": { schema: z.array(MessageRecordComponent) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/channels/{channelId}/messages",
  summary: "チャンネルにメッセージを投稿（認証必須・#48）",
  request: {
    params: z.object({ channelId: channelIdParam }),
    body: { content: { "application/json": { schema: CreateChannelMessageComponent } } },
  },
  responses: {
    201: {
      description: "作成されたメッセージ",
      content: { "application/json": { schema: MessageRecordComponent } },
    },
    400: { description: "text が空 or employeeId 未紐づけ", ...errorJson },
    401: { description: "未認証", ...errorJson },
    404: { description: "チャンネルが存在しない", ...errorJson },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/channels/{channelId}/employees",
  summary: "チャンネルに所属する Employee の id 一覧を取得",
  request: { params: z.object({ channelId: channelIdParam }) },
  responses: {
    200: {
      description: "所属 Employee の id 一覧",
      content: { "application/json": { schema: z.array(z.string()) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/channels/{channelId}/employees",
  summary: "チャンネルに Employee を追加（認証必須）",
  request: {
    params: z.object({ channelId: channelIdParam }),
    body: {
      content: { "application/json": { schema: AddChannelMemberComponent } },
    },
  },
  responses: {
    201: {
      description: "追加された所属",
      content: {
        "application/json": {
          schema: z.object({ channelId: z.string(), employeeId: z.string() }),
        },
      },
    },
    400: { description: "リクエストボディが不正（employeeId 空など）" },
    401: { description: "未認証" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/channels/{channelId}/employees/{employeeId}",
  summary: "チャンネルから Employee を除外（認証必須）",
  request: {
    params: z.object({ channelId: channelIdParam, employeeId: employeeIdParam }),
  },
  responses: {
    204: { description: "除外完了" },
    401: { description: "未認証" },
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
    400: { description: "リクエストボディが不正（displayName 空・avatarUrl 不正など）", ...errorJson },
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

// GitHub Issue 起票（#76）。認証必須。
registry.registerPath({
  method: "post",
  path: "/api/channels/{channelId}/messages/{messageId}/create-issue",
  summary: "企画 チャンネルのメッセージから GitHub Issue を起票（認証必須・#76）",
  request: {
    params: z.object({
      channelId: z.string().openapi({ description: "チャンネル ID" }),
      messageId: z.string().openapi({ description: "メッセージ ID" }),
    }),
  },
  responses: {
    201: {
      description: "Issue 起票成功。issueNumber と issueUrl を返す",
      content: {
        "application/json": {
          schema: z.object({
            issueNumber: z.number().int().positive(),
            issueUrl: z.string().url(),
          }),
        },
      },
    },
    401: { description: "未認証", ...errorJson },
    404: { description: "メッセージが存在しない", ...errorJson },
    500: { description: "GITHUB_TOKEN 等の環境変数未設定", ...errorJson },
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
  InvitationPublicSchema.openapi({ description: "招待トークン検証レスポンス（公開・機微情報なし）" }),
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
