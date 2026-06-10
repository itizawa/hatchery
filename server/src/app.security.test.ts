import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { buildSessionCookieOptions, createApp } from "./app.js";
import type { AppDeps } from "./app.js";
import { createTestDeps } from "./testing/createTestDeps.js";

/** 各テストで使う共通 deps（InMemory 一式）。beforeEach で初期化。 */
let baseDeps: AppDeps;
beforeEach(async () => {
  baseDeps = await createTestDeps();
});

describe("createApp: sessionStore の本番ガード（#186）", () => {
  it("NODE_ENV=production かつ sessionStore 未注入のとき起動時例外を投げる", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() => createApp(baseDeps)).toThrow();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("NODE_ENV=production で security に sessionSecret を省略しても SESSION_SECRET 未設定なら例外を投げる（#344）", () => {
    const original = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    try {
      expect(() =>
        createApp({
          ...baseDeps,
          sessionStore: new session.MemoryStore(),
          security: { corsAllowedOrigins: ["https://example.com"] },
        }),
      ).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.NODE_ENV = original;
      if (originalSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = originalSecret;
      }
    }
  });

  it("NODE_ENV=production でも sessionStore を注入すれば起動時例外を投げない", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "test-secret-for-production-guard-test";
    try {
      expect(() =>
        createApp({ ...baseDeps, sessionStore: new session.MemoryStore() }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = originalSecret;
      }
    }
  });
});

describe("buildSessionCookieOptions（別ドメイン配信のクロスサイト cookie）", () => {
  it("crossSiteCookie=true で SameSite=None + Secure（クロスサイトでも cookie を送信できる）", () => {
    // フロント（Cloudflare Pages）と API（Cloud Run）が別ドメインの本番/dev では
    // SameSite=Lax だと cookie が送られずログインが維持できない（#78 のクロスオリジン配信）。
    expect(buildSessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
  });

  it("crossSiteCookie=false で SameSite=Lax + secure 無効（ローカル同一オリジン）", () => {
    expect(buildSessionCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });
  });
});

describe("createApp のセキュリティ防衛", () => {
  it("レート制限の上限を超えたリクエストに 429 を返す（/health にグローバル適用）", async () => {
    const app = createApp({
      ...baseDeps,
      security: { rateLimitMax: 2, rateLimitWindowMs: 60_000 },
    });
    const agent = request(app);
    expect((await agent.get("/health")).status).toBe(200);
    expect((await agent.get("/health")).status).toBe(200);
    const res = await agent.get("/health");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("TooManyRequests");
  });

  it("ボディサイズ上限を超えるリクエストに 413 を返す", async () => {
    const app = createApp({ ...baseDeps, security: { bodyLimit: "1kb" } });
    const big = [{ createdEmployeeId: "e1", channel: "shigoto", text: "x".repeat(4000) }];
    const res = await request(app).post("/api/messages").send(big);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PayloadTooLarge");
  });

  it("全応答にセキュアヘッダを付与し X-Powered-By を除去する（/health に適用）", async () => {
    const app = createApp(baseDeps);
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("NODE_ENV=production で corsAllowedOrigins に * を含むと起動時例外を投げる", () => {
    const original = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "test-secret";
    try {
      expect(() =>
        createApp({
          ...baseDeps,
          security: { corsAllowedOrigins: ["*"] },
        }),
      ).toThrow(/CORS.*\*/);
    } finally {
      process.env.NODE_ENV = original;
      if (originalSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = originalSecret;
      }
    }
  });

  it("NODE_ENV=production で corsAllowedOrigins に明示オリジンのみ含むと正常起動する", () => {
    const original = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "test-secret";
    try {
      // sessionStore も必要（本番ガード）
      expect(() =>
        createApp({
          ...baseDeps,
          sessionStore: new session.MemoryStore(),
          security: { corsAllowedOrigins: ["https://app.example.com"] },
        }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = original;
      if (originalSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = originalSecret;
      }
    }
  });

  it("corsAllowedOrigins に含まれるオリジンへ CORS ヘッダを付与する", async () => {
    const origin = "https://app.example.com";
    const app = createApp({
      ...baseDeps,
      security: { corsAllowedOrigins: [origin] },
    });
    const res = await request(app).get("/health").set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
