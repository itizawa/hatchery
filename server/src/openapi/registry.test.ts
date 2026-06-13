import { describe, expect, it } from "vitest";

import { generateOpenApiDocument } from "./registry.js";

describe("generateOpenApiDocument", () => {
  it("OpenAPI 3.1 ドキュメントを返す", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBeDefined();
  });

  it("paths に auth/health のエンドポイントが含まれる（#455: /login は除外）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths).not.toHaveProperty("/api/auth/login");
    expect(doc.paths).toHaveProperty("/api/auth/logout");
    expect(doc.paths).toHaveProperty("/api/auth/me");
    expect(doc.paths).toHaveProperty("/api/auth/google");
    expect(doc.paths).toHaveProperty("/health");
  });

  it("components.schemas に AuthUser が含まれ LoginRequest は除外されている（#455）", () => {
    const doc = generateOpenApiDocument();
    expect(doc.components?.schemas).toHaveProperty("AuthUser");
    expect(doc.components?.schemas).not.toHaveProperty("LoginRequest");
  });

  it("AuthUser スキーマに email が含まれ loginId・passwordHash は含まれない（#455）", () => {
    const doc = generateOpenApiDocument();
    const authUser = doc.components?.schemas?.AuthUser as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    expect(authUser?.properties).toHaveProperty("email");
    expect(authUser?.properties).not.toHaveProperty("loginId");
    expect(authUser?.properties).not.toHaveProperty("passwordHash");
    expect(authUser?.properties).not.toHaveProperty("employeeId");
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

  it("invitation 系パスが OpenAPI 定義に含まれない（#455: 招待制廃止）", () => {
    const doc = generateOpenApiDocument();
    const paths = Object.keys(doc.paths ?? {});
    expect(paths.some((p) => p.includes("invitation"))).toBe(false);
  });
});
