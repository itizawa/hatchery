import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

function makeApp(role: "admin" | "member" = "admin") {
  const userRepo = createTestUserRepository(role);
  return createApp(createTestDeps({ userRepository: userRepo }));
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("GET /api/admin/community-engagement", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/admin/community-engagement");
    expect(res.status).toBe(401);
  });

  it("member ロールの場合は 403 を返す", async () => {
    const app = makeApp("member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/community-engagement");
    expect(res.status).toBe(403);
  });

  it("認証済み admin の場合は 200 と正しい形状のレスポンスを返す", async () => {
    const app = makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/community-engagement");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      windowDays: expect.any(Number),
      communityVotes: expect.any(Array),
      workerVotes: expect.any(Array),
      loyaltyScore: expect.any(Number),
      subscriberCountByCommunity: expect.any(Object),
    });
  });

  it("データが空の場合は loyaltyScore=0・communityVotes=[]・workerVotes=[] を返す", async () => {
    const app = makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/community-engagement");
    expect(res.status).toBe(200);
    expect(res.body.communityVotes).toEqual([]);
    expect(res.body.workerVotes).toEqual([]);
    expect(res.body.loyaltyScore).toBe(0);
    expect(res.body.subscriberCountByCommunity).toEqual({});
  });
});
