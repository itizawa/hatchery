import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import { MessageSchema } from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const MessageComponent = registry.register(
  "Message",
  MessageSchema.openapi({ description: "channel に直接紐づく社員の 1 発言（ADR-0009）" }),
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
