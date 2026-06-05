import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryInvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

async function makeApp(
  invitationRepo = new InMemoryInvitationLinkRepository(),
  role: "admin" | "member" = "admin",
) {
  const userRepo = await InMemoryUserRepository.createWithTestUser(null, role);
  return createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository: userRepo,
    invitationLinkRepository: invitationRepo,
  });
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("POST /admin/invitations", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).post("/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 201 と招待リンクを返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      token: expect.any(String),
      status: "active",
      memo: null,
    });
    expect(res.body.token.length).toBeGreaterThan(10);
  });

  it("expiresAt が expiresInHours 後になっている", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const before = Date.now();
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    const after = Date.now();

    const expiresAt = new Date(res.body.expiresAt).getTime();
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt).toBeLessThanOrEqual(expectedMax);
  });

  it("memo を渡すと招待に含まれる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/admin/invitations")
      .send({ expiresInHours: 24, memo: "テスト招待" });
    expect(res.status).toBe(201);
    expect(res.body.memo).toBe("テスト招待");
  });

  it("レスポンスに createdByUserId が含まれない", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("createdByUserId");
  });

  it("expiresInHours が範囲外（0）の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 0 });
    expect(res.status).toBe(400);
  });

  it("expiresInHours が範囲外（721）の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations").send({ expiresInHours: 721 });
    expect(res.status).toBe(400);
  });
});

describe("GET /admin/invitations", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/admin/invitations");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/admin/invitations");
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 200 と招待一覧をステータス込みで返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    await agent.post("/admin/invitations").send({ expiresInHours: 24 });

    const res = await agent.get("/admin/invitations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ status: "active" });
  });

  it("レスポンスに createdByUserId が含まれない", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    await agent.post("/admin/invitations").send({ expiresInHours: 24 });

    const res = await agent.get("/admin/invitations");
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty("createdByUserId");
  });
});

describe("POST /admin/invitations/:id/revoke", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).post("/admin/invitations/fake-id/revoke");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations/fake-id/revoke");
    expect(res.status).toBe(403);
  });

  it("存在しない id の場合は 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/admin/invitations/non-existent/revoke");
    expect(res.status).toBe(404);
  });

  it("招待を失効させ、ステータスが revoked になる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const createRes = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    const id = createRes.body.id;

    const revokeRes = await agent.post(`/admin/invitations/${id}/revoke`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.status).toBe("revoked");
  });

  it("失効後に一覧を取得するとステータスが revoked になっている", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const createRes = await agent.post("/admin/invitations").send({ expiresInHours: 24 });
    const id = createRes.body.id;

    await agent.post(`/admin/invitations/${id}/revoke`);

    const listRes = await agent.get("/admin/invitations");
    expect(listRes.body[0].status).toBe("revoked");
  });
});
