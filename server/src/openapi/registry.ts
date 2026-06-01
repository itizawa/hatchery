import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import {
  AddChannelMemberSchema,
  AuthUserSchema,
  ChannelSchema,
  CreateChannelSchema,
  EmployeeSchema,
  LoginRequestSchema,
  MessageSchema,
  UpdateChannelSchema,
  UpdateEmployeeSchema,
} from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const MessageComponent = registry.register(
  "Message",
  MessageSchema.openapi({ description: "channel に直接紐づく社員の 1 発言（ADR-0009）" }),
);

const ChannelComponent = registry.register(
  "Channel",
  ChannelSchema.openapi({ description: "チャンネル（id / label）" }),
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
  path: "/messages",
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
  path: "/messages",
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
  method: "patch",
  path: "/employees/{id}",
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
  path: "/channels",
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
  path: "/channels",
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
  path: "/channels/{id}",
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

registry.registerPath({
  method: "get",
  path: "/channels/{channelId}/employees",
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
  path: "/channels/{channelId}/employees",
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
  path: "/channels/{channelId}/employees/{employeeId}",
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
  path: "/auth/login",
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
  path: "/auth/logout",
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
  path: "/auth/me",
  summary: "現在の認証済みユーザーを取得（認証必須）",
  responses: {
    200: {
      description: "認証済みユーザー",
      content: { "application/json": { schema: AuthUserComponent } },
    },
    401: { description: "未認証", ...errorJson },
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
