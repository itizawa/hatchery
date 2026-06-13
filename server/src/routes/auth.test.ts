import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { UserRepository } from "../persistence/userRepository.js";
import { createInMemoryUserRepository, createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

function buildApp(userRepo?: UserRepository) {
  const repo = userRepo ?? createTestUserRepository();
  return createApp(createTestDeps({ userRepository: repo }));
}

// dev-login 経由でセッションを確立するヘルパ
async function loginAsDevUser(agent: ReturnType<typeof request.agent>) {
  const res = await agent.post("/api/auth/dev-login");
  expect(res.status).toBe(200);
}

describe("POST /api/auth/login の廃止 (#455)", () => {
  it("POST /api/auth/login は 404 を返す", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/auth/dev-login (#455)", () => {
  it("NODE_ENV が production でないとき dev ユーザーでログインし 200 を返す", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/auth/dev-login");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "dev@hatchery.local" });
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("dev ユーザーが存在しない場合は 404 を返す", async () => {
    const emptyRepo = createInMemoryUserRepository([]);
    const app = buildApp(emptyRepo);
    const res = await request(app).post("/api/auth/dev-login");
    expect(res.status).toBe(404);
  });

  it("NODE_ENV が production のとき dev-login は 404 を返す", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;
    const originalAppSecret = process.env.APP_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "test-secret-for-dev-login-prod-test";
    process.env.APP_SECRET = "test-app-secret-for-dev-login-prod-test";
    try {
      const { MemoryStore } = await import("express-session");
      const app = createApp(createTestDeps({ sessionStore: new MemoryStore() }));
      const res = await request(app).post("/api/auth/dev-login");
      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = originalSecret;
      if (originalAppSecret === undefined) delete process.env.APP_SECRET;
      else process.env.APP_SECRET = originalAppSecret;
    }
  });
});

describe("GET /api/auth/me", () => {
  it("セッション cookie ありで 200 と AuthUser が返る", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "dev@hatchery.local", displayName: "claude-dev" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("セッション cookie なしで 401 が返る", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("レスポンスに passwordHash・loginId が含まれない", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("loginId");
  });

  it("レスポンスに role が含まれる (#136)", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("role");
    expect(["admin", "member"]).toContain(res.body.role);
  });
});

describe("セッション永続化（#186）: 同一ストアを共有する別インスタンスでセッションが維持される", () => {
  it("ログイン後、同じストアを持つ別アプリインスタンスで GET /api/auth/me が 200 を返す（サーバ再起動模擬）", async () => {
    const sharedStore = new session.MemoryStore();
    const repo = createTestUserRepository();

    const app1 = createApp(createTestDeps({ userRepository: repo, sessionStore: sharedStore }));
    const loginRes = await request(app1).post("/api/auth/dev-login");
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"] as string[];
    expect(cookies).toBeDefined();

    const app2 = createApp(createTestDeps({ userRepository: repo, sessionStore: sharedStore }));
    const meRes = await request(app2).get("/api/auth/me").set("Cookie", cookies.join("; "));
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ email: "dev@hatchery.local" });
  });

  it("ストアが異なる別アプリインスタンスではセッションが引き継がれず 401 になる", async () => {
    const repo = createTestUserRepository();

    const app1 = createApp(createTestDeps({ userRepository: repo, sessionStore: new session.MemoryStore() }));
    const loginRes = await request(app1).post("/api/auth/dev-login");
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"] as string[];

    const app2 = createApp(createTestDeps({ userRepository: repo, sessionStore: new session.MemoryStore() }));
    const meRes = await request(app2).get("/api/auth/me").set("Cookie", cookies.join("; "));
    expect(meRes.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("ログアウト後に GET /api/auth/me が 401 になる", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const before = await agent.get("/api/auth/me");
    expect(before.status).toBe(200);
    await agent.post("/api/auth/logout");
    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
  });
});

describe("requireAuth ミドルウェア", () => {
  it("保護されたルートに未ログインでアクセスすると 401 が返る", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("保護されたルートに認証済みでアクセスすると成功する", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/auth/me (#51)", () => {
  it("未認証で 401 が返る", async () => {
    const app = buildApp();
    const res = await request(app).patch("/api/auth/me").send({ displayName: "New Name" });
    expect(res.status).toBe(401);
  });

  it("認証済みで displayName のみ送ると 200 で更新後のユーザーが返る", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.patch("/api/auth/me").send({ displayName: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: "Updated Name" });
  });

  it("認証済みで displayName + avatarUrl を送ると 200 で更新後のユーザーが返る", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.patch("/api/auth/me").send({
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: "Alice", avatarUrl: "https://example.com/avatar.png" });
  });

  it("displayName が空文字のとき 400 が返る", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.patch("/api/auth/me").send({ displayName: "" });
    expect(res.status).toBe(400);
  });

  it("avatarUrl が不正な URL 形式のとき 400 が返る", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.patch("/api/auth/me").send({ displayName: "Alice", avatarUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("レスポンスに passwordHash が含まれない", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const res = await agent.patch("/api/auth/me").send({ displayName: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("更新後に GET /api/auth/me で更新内容が反映される", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    await agent.patch("/api/auth/me").send({ displayName: "Changed Name" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Changed Name");
  });

  it("role を送っても無視される（自己昇格防止 #136）", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await loginAsDevUser(agent);
    const before = await agent.get("/api/auth/me");
    const originalRole = before.body.role;
    const res = await agent.patch("/api/auth/me").send({ displayName: "Alice", role: "member" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(originalRole);
  });
});

describe("GET /api/auth/google (#343)", () => {
  it("Google 認証設定がある場合は 302 で Google OAuth URL へリダイレクトする", async () => {
    const app = createApp(
      createTestDeps({
        googleAuth: {
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          callbackUrl: "http://localhost/api/auth/google/callback",
        },
      }),
    );
    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(302);
    expect(res.headers["location"]).toMatch(/accounts\.google\.com/);
  });

  it("Google 認証設定がない場合は 404 が返る", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(404);
  });
});
