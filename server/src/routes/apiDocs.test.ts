import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { AppDeps } from "../app.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { isApiDocsEnabled } from "./apiDocs.js";

let baseDeps: AppDeps;
beforeEach(async () => {
  baseDeps = await createTestDeps();
});

/** NODE_ENV を一時的に書き換えるユーティリティ。各テストで afterEach により復元する。 */
const originalNodeEnv = process.env.NODE_ENV;
const originalEnableApiDocs = process.env.ENABLE_API_DOCS;
afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEnableApiDocs === undefined) delete process.env.ENABLE_API_DOCS;
  else process.env.ENABLE_API_DOCS = originalEnableApiDocs;
});

describe("isApiDocsEnabled（API ドキュメント配信のトグル判定）", () => {
  it("dev（NODE_ENV != production）かつ未設定なら有効（既定 ON）", () => {
    expect(isApiDocsEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("本番（NODE_ENV = production）かつ未設定なら無効（既定 OFF）", () => {
    expect(isApiDocsEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("ENABLE_API_DOCS=true なら本番でも有効", () => {
    expect(isApiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "true" })).toBe(true);
    expect(isApiDocsEnabled({ NODE_ENV: "production", ENABLE_API_DOCS: "1" })).toBe(true);
  });

  it("ENABLE_API_DOCS=false なら dev でも無効", () => {
    expect(isApiDocsEnabled({ NODE_ENV: "development", ENABLE_API_DOCS: "false" })).toBe(false);
    expect(isApiDocsEnabled({ NODE_ENV: "development", ENABLE_API_DOCS: "0" })).toBe(false);
  });
});

describe("API ドキュメント配信ルート（dev = 有効）", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.ENABLE_API_DOCS;
  });

  it("GET /openapi.json は 200・application/json で生成 OpenAPI を返し registry の主要パスを含む", async () => {
    const res = await request(createApp(baseDeps)).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths).toBeDefined();
    // registry に登録済みの主要パス（手書きではなく生成ロジック由来であること）
    expect(res.body.paths["/api/workers"]).toBeDefined();
    expect(res.body.paths["/api/auth/login"]).toBeDefined();
  });

  it("GET /api-docs は 200・text/html で Redoc を読み込む HTML を返す", async () => {
    const res = await request(createApp(baseDeps)).get("/api-docs");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text.toLowerCase()).toContain("redoc");
    // /openapi.json を spec として参照していること
    expect(res.text).toContain("/openapi.json");
  });

  it("GET /api-docs の CSP は cdn.redoc.ly のスクリプト読み込みを許可する", async () => {
    const res = await request(createApp(baseDeps)).get("/api-docs");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src");
    expect(csp).toContain("cdn.redoc.ly");
  });
});

describe("API ドキュメント配信ルート（本番無効 = 404）", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_API_DOCS;
    process.env.SESSION_SECRET = "test-secret-for-api-docs-prod-test";
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("本番かつトグル無効では /openapi.json は 404", async () => {
    const app = createApp({ ...baseDeps, sessionStore: new (await import("express-session")).MemoryStore() });
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(404);
  });

  it("本番かつトグル無効では /api-docs は 404", async () => {
    const app = createApp({ ...baseDeps, sessionStore: new (await import("express-session")).MemoryStore() });
    const res = await request(app).get("/api-docs");
    expect(res.status).toBe(404);
  });
});
