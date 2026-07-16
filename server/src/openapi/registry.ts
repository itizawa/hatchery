import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { AuthUserSchema, UserRoleSchema, WorkerSchema } from "@hatchery/common";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

import { registerAdmin } from "./registrations/registerAdmin.js";
import { registerAuth } from "./registrations/registerAuth.js";
import { registerCommunities } from "./registrations/registerCommunities.js";
import { registerDashboard } from "./registrations/registerDashboard.js";
import { registerFeed } from "./registrations/registerFeed.js";
import { registerHealth } from "./registrations/registerHealth.js";
import { registerOgp } from "./registrations/registerOgp.js";
import { registerPosts } from "./registrations/registerPosts.js";
import { registerPushSubscriptions } from "./registrations/registerPushSubscriptions.js";
import { registerRanking } from "./registrations/registerRanking.js";
import { registerSubscriptions } from "./registrations/registerSubscriptions.js";
import { registerWorkers } from "./registrations/registerWorkers.js";
import type { RegistryContext } from "./registrations/shared.js";

extendZodWithOpenApi(z);

/**
 * OpenAPI レジストリを構築する集約点（#535）。
 *
 * 登録ロジックは `registrations/registerXxx.ts` にリソース別へ分割してある。
 * `registry.register` は呼び出し順で `components.schemas` の、`registerPath` は `paths` の
 * 出力順が決まるため、ここで **分割前と同一の順序** で各モジュールを呼び出すことで
 * 生成される `openapi.json` を不変に保つ（受け入れ条件 2・registry.snapshot.test.ts で担保）。
 */
function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  // クロスリソースで共有する component を分割前と同じ順序で先に register する。
  registry.register("UserRole", UserRoleSchema.openapi({ description: "ユーザー権限ロール（#136）" }));

  const AuthUserComponent = registry.register(
    "AuthUser",
    AuthUserSchema.openapi({
      description: "認証済みユーザーの公開情報（passwordHash 等は含まない）",
    }),
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

  const ctx: RegistryContext = { errorJson, AuthUserComponent, WorkerComponent };

  // 分割前の registry.ts のセクション順を維持してモジュールを呼ぶ。
  // registerCommunities が Post / Comment component を ctx に代入するため、
  // registerFeed / registerPosts / registerWorkers（#929: /:workerId/posts で PostComponent 参照）は
  // その後で呼ぶ必要がある。
  registerAuth({ registry, ctx });
  registerAdmin({ registry, ctx });
  registerHealth(registry);
  registerCommunities({ registry, ctx });
  registerWorkers({ registry, ctx });
  registerFeed({ registry, ctx });
  registerPosts({ registry, ctx });
  registerSubscriptions({ registry, ctx });
  registerPushSubscriptions({ registry, ctx });
  registerOgp(registry);
  // #1065: 末尾に追加（既存セクションの登録順序は変えない）。
  registerRanking({ registry, ctx });
  // #1113: 末尾に追加（既存セクションの登録順序は変えない）。
  registerDashboard(registry);

  return registry;
}

/** OpenAPI 3.1 ドキュメントを生成して返す。generate.ts やテストから呼ぶ。 */
export function generateOpenApiDocument(): OpenAPIObject {
  const registry = buildRegistry();
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
