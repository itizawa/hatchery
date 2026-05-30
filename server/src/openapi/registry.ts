import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import { AddChannelMemberSchema, MessageSchema } from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const MessageComponent = registry.register(
  "Message",
  MessageSchema.openapi({ description: "channel に直接紐づく社員の 1 発言（ADR-0009）" }),
);

const AddChannelMemberComponent = registry.register(
  "AddChannelMember",
  AddChannelMemberSchema.openapi({
    description: "チャンネルへ Employee を追加するリクエストボディ（#33）",
  }),
);

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

// チャンネルへの Employee 所属（多対多 / #33）。
const channelIdParam = z.string().openapi({ param: { name: "channelId", in: "path" } });
const employeeIdParam = z.string().openapi({ param: { name: "employeeId", in: "path" } });

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
