import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryInvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(
  invitationRepo = new InMemoryInvitationLinkRepository(),
  role: "admin" | "member" = "admin",
) {
  const userRepo = await InMemoryUserRepository.createWithTestUser(null, role);
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      invitationLinkRepository: invitationRepo,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

/** admin として招待リンクを 1 件作成し、token を返す。 */
async function createInvitationToken(
  app: ReturnType<typeof createApp>,
  expiresInHours = 24,
): Promise<string> {
  const agent = await loginAgent(app);
  const res = await agent.post("/api/admin/invitations").send({ expiresInHours });
  return res.body.token as string;
}

describe("POST /api/admin/invitations", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 201 と招待リンクを返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
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
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
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
      .post("/api/admin/invitations")
      .send({ expiresInHours: 24, memo: "テスト招待" });
    expect(res.status).toBe(201);
    expect(res.body.memo).toBe("テスト招待");
  });

  it("レスポンスに createdByUserId が含まれない", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("createdByUserId");
  });

  it("expiresInHours が範囲外（0）の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 0 });
    expect(res.status).toBe(400);
  });

  it("expiresInHours が範囲外（721）の場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations").send({ expiresInHours: 721 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/invitations", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/admin/invitations");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/invitations");
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 200 と招待一覧をステータス込みで返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });

    const res = await agent.get("/api/admin/invitations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ status: "active" });
  });

  it("レスポンスに createdByUserId が含まれない", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });

    const res = await agent.get("/api/admin/invitations");
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty("createdByUserId");
  });
});

describe("POST /api/admin/invitations/:id/revoke", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/admin/invitations/fake-id/revoke");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(new InMemoryInvitationLinkRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations/fake-id/revoke");
    expect(res.status).toBe(403);
  });

  it("存在しない id の場合は 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/invitations/non-existent/revoke");
    expect(res.status).toBe(404);
  });

  it("招待を失効させ、ステータスが revoked になる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const createRes = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
    const id = createRes.body.id;

    const revokeRes = await agent.post(`/api/admin/invitations/${id}/revoke`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.status).toBe("revoked");
  });

  it("失効後に一覧を取得するとステータスが revoked になっている", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const createRes = await agent.post("/api/admin/invitations").send({ expiresInHours: 24 });
    const id = createRes.body.id;

    await agent.post(`/api/admin/invitations/${id}/revoke`);

    const listRes = await agent.get("/api/admin/invitations");
    expect(listRes.body[0].status).toBe("revoked");
  });
});

describe("GET /api/invitations/:token (#132)", () => {
  it("存在しない token は 404 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/invitations/nonexistent-token");
    expect(res.status).toBe(404);
  });

  it("有効な token は 200 と status: active を返す", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app).get(`/api/invitations/${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "active" });
    expect(res.body).toHaveProperty("expiresAt");
  });

  it("使用済みトークンは 200 と status: used を返す", async () => {
    const repo = new InMemoryInvitationLinkRepository();
    const app = await makeApp(repo);
    const token = await createInvitationToken(app);

    await request(app).post(`/api/invitations/${token}/accept`).send({
      loginId: "newuser1",
      displayName: "新ユーザー",
      password: "password123",
    });

    const res = await request(app).get(`/api/invitations/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("used");
  });

  it("レスポンスに token が含まれない", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app).get(`/api/invitations/${token}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("token");
    expect(res.body).not.toHaveProperty("id");
    expect(res.body).not.toHaveProperty("createdByUserId");
  });
});

describe("POST /api/invitations/:token/accept (#132)", () => {
  const validBody = {
    loginId: "newuser",
    displayName: "新規ユーザー",
    password: "password123",
  };

  it("存在しない token は 404 を返す", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/invitations/nonexistent/accept")
      .send(validBody);
    expect(res.status).toBe(404);
  });

  it("active な招待で 201 と AuthUser を返す", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app).post(`/api/invitations/${token}/accept`).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      loginId: "newuser",
      displayName: "新規ユーザー",
      role: "member",
    });
  });

  it("レスポンスに passwordHash が含まれない", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app).post(`/api/invitations/${token}/accept`).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("受諾成功後 GET /auth/me が新ユーザーを返す（セッション確立）", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const agent = request.agent(app);
    const acceptRes = await agent.post(`/api/invitations/${token}/accept`).send(validBody);
    expect(acceptRes.status).toBe(201);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ loginId: "newuser", displayName: "新規ユーザー" });
  });

  it("同じ token への 2 回目の accept は 409 を返す（single-use）", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    await request(app).post(`/api/invitations/${token}/accept`).send(validBody);
    const res2 = await request(app)
      .post(`/api/invitations/${token}/accept`)
      .send({ loginId: "newuser2", displayName: "別ユーザー", password: "password123" });
    expect(res2.status).toBe(409);
  });

  it("期限切れトークンは 409 を返す", async () => {
    const repo = new InMemoryInvitationLinkRepository();
    const pastDate = new Date(Date.now() - 1000);
    await repo.create({
      token: "expired-token",
      expiresAt: pastDate,
      createdByUserId: "admin",
    });
    const app = await makeApp(repo);
    const res = await request(app)
      .post("/api/invitations/expired-token/accept")
      .send(validBody);
    expect(res.status).toBe(409);
  });

  it("失効済みトークンは 409 を返す", async () => {
    const repo = new InMemoryInvitationLinkRepository();
    const record = await repo.create({
      token: "revoked-token",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdByUserId: "admin",
    });
    await repo.revoke(record.id);
    const app = await makeApp(repo);
    const res = await request(app)
      .post("/api/invitations/revoked-token/accept")
      .send(validBody);
    expect(res.status).toBe(409);
  });

  it("loginId 重複時は 409 を返し usedAt が立たない", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);

    const res = await request(app).post(`/api/invitations/${token}/accept`).send({
      loginId: "testuser",
      displayName: "重複ユーザー",
      password: "password123",
    });
    expect(res.status).toBe(409);

    const statusRes = await request(app).get(`/api/invitations/${token}`);
    expect(statusRes.body.status).toBe("active");
  });

  it("password が 7 文字以下は 400 を返す", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app)
      .post(`/api/invitations/${token}/accept`)
      .send({ ...validBody, password: "short12" });
    expect(res.status).toBe(400);
  });

  it("loginId が空文字列は 400 を返す", async () => {
    const app = await makeApp();
    const token = await createInvitationToken(app);
    const res = await request(app)
      .post(`/api/invitations/${token}/accept`)
      .send({ ...validBody, loginId: "" });
    expect(res.status).toBe(400);
  });
});
