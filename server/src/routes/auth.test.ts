import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import type { UserRepository } from "../persistence/userRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

async function buildApp(userRepo?: UserRepository) {
  const repo = userRepo ?? (await InMemoryUserRepository.createWithTestUser());
  return createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository: repo,
  });
}

describe("POST /auth/login", () => {
  it("正しい資格情報で 200 と Set-Cookie が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ id: "testuser", password: "testpass" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.body).toMatchObject({ id: "testuser", displayName: "Test User" });
  });

  it("間違ったパスワードで 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ id: "testuser", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("存在しない id で 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ id: "nobody", password: "pass" });
    expect(res.status).toBe(401);
  });

  it("空フィールドで 400 が返る（Zod バリデーション）", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ id: "", password: "pass" });
    expect(res.status).toBe(400);
  });
});

describe("GET /auth/me", () => {
  it("セッション cookie ありで 200 と AuthUser が返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "testuser", displayName: "Test User" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("セッション cookie なしで 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  // #49: User ↔ Employee を JOIN し、自身の employeeId を返す。
  it("Employee が紐づくユーザーでは employeeId を含む（AC-9）", async () => {
    const repo = await InMemoryUserRepository.createWithTestUser("emp-testuser");
    const app = await buildApp(repo);
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "testuser", employeeId: "emp-testuser" });
  });

  it("Employee が紐づかないユーザーでは employeeId を含めない（AC-10）", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("employeeId");
  });
});

describe("POST /auth/logout", () => {
  it("ログアウト後に GET /auth/me が 401 になる", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const before = await agent.get("/auth/me");
    expect(before.status).toBe(200);
    await agent.post("/auth/logout");
    const after = await agent.get("/auth/me");
    expect(after.status).toBe(401);
  });
});

describe("requireAuth ミドルウェア", () => {
  it("保護されたルートに未ログインでアクセスすると 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("保護されたルートに認証済みでアクセスすると成功する", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.get("/auth/me");
    expect(res.status).toBe(200);
  });
});

describe("PATCH /auth/me (#51)", () => {
  it("未認証で 401 が返る", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/auth/me").send({ displayName: "New Name" });
    expect(res.status).toBe(401);
  });

  it("認証済みで displayName のみ送ると 200 で更新後のユーザーが返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.patch("/auth/me").send({ displayName: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "testuser", displayName: "Updated Name" });
  });

  it("認証済みで displayName + avatarUrl を送ると 200 で更新後のユーザーが返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.patch("/auth/me").send({
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
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.patch("/auth/me").send({ displayName: "" });
    expect(res.status).toBe(400);
  });

  it("avatarUrl が不正な URL 形式のとき 400 が返る", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.patch("/auth/me").send({ displayName: "Alice", avatarUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("レスポンスに passwordHash が含まれない", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    const res = await agent.patch("/auth/me").send({ displayName: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("更新後に GET /auth/me で更新内容が反映される", async () => {
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
    await agent.patch("/auth/me").send({ displayName: "Changed Name" });
    const res = await agent.get("/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Changed Name");
  });
});
