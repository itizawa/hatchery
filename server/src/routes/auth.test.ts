import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import type { UserRepository } from "../persistence/userRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function buildApp(userRepo?: UserRepository) {
  const repo = userRepo ?? (await createTestUserRepository());
  return createApp(await createTestDeps({ userRepository: repo }));
}

describe("POST /api/auth/login", () => {
  it("正しい資格情報で 200 と Set-Cookie が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.body).toMatchObject({ loginId: "testuser", displayName: "Test User" });
  });

  it("間違ったパスワードで 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("存在しない loginId で 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "nobody", password: "pass" });
    expect(res.status).toBe(401);
  });

  it("空フィールドで 400 が返る（Zod バリデーション）", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "", password: "pass" });
    expect(res.status).toBe(400);
  });

  it("レスポンスに passwordHash が含まれない（#68）", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
  });
});

describe("GET /api/auth/me", () => {
  it("セッション cookie ありで 200 と AuthUser が返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "testuser", displayName: "Test User" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("セッション cookie なしで 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  // #331: ADR-0020 後処理。User ↔ Worker の 1:1 リレーションを撤廃したため employeeId は返さない。
  it("レスポンスに employeeId を含めない（#331）", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("employeeId");
  });

  it("レスポンスに passwordHash が含まれない（#68）", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("レスポンスに role が含まれる (#136)", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("role");
    expect(["admin", "member"]).toContain(res.body.role);
  });
});

describe("セッション永続化（#186）: 同一ストアを共有する別インスタンスでセッションが維持される", () => {
  it("ログイン後、同じストアを持つ別アプリインスタンスで GET /api/auth/me が 200 を返す（サーバ再起動模擬）", async () => {
    const sharedStore = new session.MemoryStore();
    const repo = await createTestUserRepository();

    // app1 でログイン
    const app1 = createApp(await createTestDeps({ userRepository: repo, sessionStore: sharedStore }));
    const loginRes = await request(app1)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"] as string[];
    expect(cookies).toBeDefined();

    // app2: 同じストアを共有するが別インスタンス（サーバ再起動後を模擬）
    const app2 = createApp(await createTestDeps({ userRepository: repo, sessionStore: sharedStore }));
    const meRes = await request(app2)
      .get("/api/auth/me")
      .set("Cookie", cookies.join("; "));
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ id: "testuser" });
  });

  it("ストアが異なる別アプリインスタンスではセッションが引き継がれず 401 になる", async () => {
    const repo = await createTestUserRepository();

    // app1 でログイン（独立したストア）
    const app1 = createApp(
      await createTestDeps({ userRepository: repo, sessionStore: new session.MemoryStore() }),
    );
    const loginRes = await request(app1)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"] as string[];

    // app2: 別のストアを持つインスタンス（セッション情報なし）
    const app2 = createApp(
      await createTestDeps({ userRepository: repo, sessionStore: new session.MemoryStore() }),
    );
    const meRes = await request(app2)
      .get("/api/auth/me")
      .set("Cookie", cookies.join("; "));
    expect(meRes.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("ログアウト後に GET /api/auth/me が 401 になる", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const before = await agent.get("/api/auth/me");
    expect(before.status).toBe(200);
    await agent.post("/api/auth/logout");
    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
  });
});

describe("requireAuth ミドルウェア", () => {
  it("保護されたルートに未ログインでアクセスすると 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("保護されたルートに認証済みでアクセスすると成功する", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/auth/me (#51)", () => {
  it("未認証で 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/api/auth/me").send({ displayName: "New Name" });
    expect(res.status).toBe(401);
  });

  it("認証済みで displayName のみ送ると 200 で更新後のユーザーが返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.patch("/api/auth/me").send({ displayName: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "testuser", displayName: "Updated Name" });
  });

  it("認証済みで displayName + avatarUrl を送ると 200 で更新後のユーザーが返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.patch("/api/auth/me").send({
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "testuser",
      displayName: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("displayName が空文字のとき 400 が返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.patch("/api/auth/me").send({ displayName: "" });
    expect(res.status).toBe(400);
  });

  it("avatarUrl が不正な URL 形式のとき 400 が返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.patch("/api/auth/me").send({ displayName: "Alice", avatarUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("レスポンスに passwordHash が含まれない", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const res = await agent.patch("/api/auth/me").send({ displayName: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("更新後に GET /api/auth/me で更新内容が反映される", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    await agent.patch("/api/auth/me").send({ displayName: "Changed Name" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Changed Name");
  });

  it("role を送っても無視される（自己昇格防止 #136）", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const before = await agent.get("/api/auth/me");
    const originalRole = before.body.role;
    const res = await agent.patch("/api/auth/me").send({ displayName: "Alice", role: "member" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(originalRole);
  });
});
