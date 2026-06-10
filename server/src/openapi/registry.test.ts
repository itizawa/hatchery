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

  // #49: AuthUser に自身の employeeId（任意）が含まれる。
  it("AuthUser スキーマに employeeId プロパティが含まれる（AC-11）", () => {
    const doc = generateOpenApiDocument();
    const authUser = doc.components?.schemas?.AuthUser as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    expect(authUser?.properties).toHaveProperty("employeeId");
    expect(authUser?.required ?? []).not.toContain("employeeId");
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
});
