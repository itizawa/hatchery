import { describe, expect, it } from "vitest";

import { generateOpenApiDocument } from "./registry.js";

describe("generateOpenApiDocument", () => {
  it("OpenAPI 3.1 ドキュメントを返す", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBeDefined();
  });

  // #41: createApp が登録する全エンドポイントが spec に含まれること。
  it("paths に auth/health のエンドポイントが含まれる", () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths).toHaveProperty("/api/auth/login");
    expect(doc.paths).toHaveProperty("/api/auth/logout");
    expect(doc.paths).toHaveProperty("/api/auth/me");
    expect(doc.paths).toHaveProperty("/health");
  });

  it("components.schemas に AuthUser と LoginRequest が含まれる", () => {
    const doc = generateOpenApiDocument();
    expect(doc.components?.schemas).toHaveProperty("AuthUser");
    expect(doc.components?.schemas).toHaveProperty("LoginRequest");
  });

  // #331: ADR-0020 後処理。AuthUser から employeeId を削除した。
  it("AuthUser スキーマに employeeId プロパティが含まれない（#331）", () => {
    const doc = generateOpenApiDocument();
    const authUser = doc.components?.schemas?.AuthUser as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    expect(authUser?.properties).not.toHaveProperty("employeeId");
  });

  it("/auth/login(post) は LoginRequest を受け取り 200 で AuthUser を返す", () => {
    const doc = generateOpenApiDocument();
    const login = doc.paths?.["/api/auth/login"]?.post;
    expect(login).toBeDefined();
    const reqRef = (login?.requestBody as { content?: Record<string, { schema?: { $ref?: string } }> })
      ?.content?.["application/json"]?.schema?.$ref;
    expect(reqRef).toBe("#/components/schemas/LoginRequest");
    const okRef = (
      login?.responses?.["200"] as { content?: Record<string, { schema?: { $ref?: string } }> }
    )?.content?.["application/json"]?.schema?.$ref;
    expect(okRef).toBe("#/components/schemas/AuthUser");
  });

  it("/auth/me(get) は 200 で AuthUser を返し 401 を定義する", () => {
    const doc = generateOpenApiDocument();
    const me = doc.paths?.["/api/auth/me"]?.get;
    expect(me).toBeDefined();
    const okRef = (
      me?.responses?.["200"] as { content?: Record<string, { schema?: { $ref?: string } }> }
    )?.content?.["application/json"]?.schema?.$ref;
    expect(okRef).toBe("#/components/schemas/AuthUser");
    expect(me?.responses?.["401"]).toBeDefined();
  });

  it("paths に /api/communities が含まれる（ADR-0019）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths).toHaveProperty("/api/communities");
  });

  it("components.schemas に Community と Post が含まれる（ADR-0019）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.components?.schemas).toHaveProperty("Community");
    expect(doc.components?.schemas).toHaveProperty("Post");
  });

  // #337: admin 系 5 エンドポイントの OpenAPI 登録。
  type RefContent = { content?: Record<string, { schema?: { $ref?: string } }> };

  it("paths に admin communities/workers の 5 エンドポイントが含まれる（#337）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths?.["/api/admin/communities"]?.get).toBeDefined();
    expect(doc.paths?.["/api/admin/communities"]?.post).toBeDefined();
    expect(doc.paths?.["/api/admin/communities/{id}"]?.patch).toBeDefined();
    expect(doc.paths?.["/api/admin/workers"]?.post).toBeDefined();
    expect(doc.paths?.["/api/admin/workers/{id}"]?.delete).toBeDefined();
  });

  it("components.schemas に CreateCommunity / UpdateCommunity / CreateWorker が含まれる（#337）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.components?.schemas).toHaveProperty("CreateCommunity");
    expect(doc.components?.schemas).toHaveProperty("UpdateCommunity");
    expect(doc.components?.schemas).toHaveProperty("CreateWorker");
  });

  it("GET /api/admin/communities は 200 で Community 配列を返す（#337）", () => {
    const doc = generateOpenApiDocument();
    const get = doc.paths?.["/api/admin/communities"]?.get;
    const items = (
      (get?.responses?.["200"] as RefContent)?.content?.["application/json"]?.schema as {
        items?: { $ref?: string };
      }
    )?.items?.$ref;
    expect(items).toBe("#/components/schemas/Community");
  });

  it("POST /api/admin/communities は CreateCommunity を受け取り 201 で Community を返す（#337）", () => {
    const doc = generateOpenApiDocument();
    const post = doc.paths?.["/api/admin/communities"]?.post;
    const reqRef = (post?.requestBody as RefContent)?.content?.["application/json"]?.schema?.$ref;
    expect(reqRef).toBe("#/components/schemas/CreateCommunity");
    const okRef = (post?.responses?.["201"] as RefContent)?.content?.["application/json"]?.schema
      ?.$ref;
    expect(okRef).toBe("#/components/schemas/Community");
  });

  it("PATCH /api/admin/communities/{id} は UpdateCommunity を受け取り 200 で Community を返す（#337）", () => {
    const doc = generateOpenApiDocument();
    const patch = doc.paths?.["/api/admin/communities/{id}"]?.patch;
    const reqRef = (patch?.requestBody as RefContent)?.content?.["application/json"]?.schema?.$ref;
    expect(reqRef).toBe("#/components/schemas/UpdateCommunity");
    const okRef = (patch?.responses?.["200"] as RefContent)?.content?.["application/json"]?.schema
      ?.$ref;
    expect(okRef).toBe("#/components/schemas/Community");
  });

  it("POST /api/admin/workers は CreateWorker を受け取り 201 で Worker を返す（#337）", () => {
    const doc = generateOpenApiDocument();
    const post = doc.paths?.["/api/admin/workers"]?.post;
    const reqRef = (post?.requestBody as RefContent)?.content?.["application/json"]?.schema?.$ref;
    expect(reqRef).toBe("#/components/schemas/CreateWorker");
    const okRef = (post?.responses?.["201"] as RefContent)?.content?.["application/json"]?.schema
      ?.$ref;
    expect(okRef).toBe("#/components/schemas/Worker");
  });

  it("DELETE /api/admin/workers/{id} は 200 で id / deletedAt を持つオブジェクトを返す（#337）", () => {
    const doc = generateOpenApiDocument();
    const del = doc.paths?.["/api/admin/workers/{id}"]?.delete;
    const schema = (del?.responses?.["200"] as RefContent)?.content?.["application/json"]
      ?.schema as { properties?: Record<string, unknown> } | undefined;
    expect(schema?.properties).toHaveProperty("id");
    expect(schema?.properties).toHaveProperty("deletedAt");
  });
});
