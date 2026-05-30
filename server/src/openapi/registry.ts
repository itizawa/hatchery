import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import { MessageSchema, SceneSchema } from "@hatchery/common";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const MessageComponent = registry.register(
  "Message",
  MessageSchema.openapi({ description: "社員の 1 発言" }),
);

const SceneComponent = registry.register(
  "Scene",
  SceneSchema.extend({
    messages: z.array(MessageComponent).min(1),
  }).openapi({ description: "1 定時で生成される 1 シーン" }),
);

registry.registerPath({
  method: "get",
  path: "/scenes",
  summary: "シーン一覧を取得",
  responses: {
    200: {
      description: "シーン一覧",
      content: {
        "application/json": {
          schema: z.array(SceneComponent),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/scenes",
  summary: "シーンを作成",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SceneComponent,
        },
      },
    },
  },
  responses: {
    201: {
      description: "作成されたシーン",
      content: {
        "application/json": {
          schema: SceneComponent,
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
