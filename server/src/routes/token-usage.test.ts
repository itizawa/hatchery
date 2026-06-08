import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(
  tokenRepo = new InMemoryTokenUsageLogRepository(),
  role: "admin" | "member" = "admin",
) {
  const userRepo = await InMemoryUserRepository.createWithTestUser(undefined, role);
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      tokenUsageLogRepository: tokenRepo,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("GET /api/admin/token-usage", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/admin/token-usage");
    expect(res.status).toBe(401);
  });

  it("member ロールの場合は 403 を返す", async () => {
    const app = await makeApp(new InMemoryTokenUsageLogRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/token-usage");
    expect(res.status).toBe(403);
  });

  it("認証済み admin の場合は 200 と空の logs + 0 の summary を返す（ログ未登録時）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/token-usage");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      logs: [],
      summary: { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 },
    });
  });

  it("認証済み admin の場合は 200 と使用量一覧・集計を返す", async () => {
    const tokenRepo = new InMemoryTokenUsageLogRepository();
    await tokenRepo.create({ model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 50, batchRunLogId: null });
    await tokenRepo.create({ model: "claude-haiku-4-5", inputTokens: 200, outputTokens: 100, batchRunLogId: "batch-1" });
    const app = await makeApp(tokenRepo);
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/token-usage");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect((res.body.logs as unknown[]).length).toBe(2);
    expect(res.body.summary).toMatchObject({
      totalInputTokens: 300,
      totalOutputTokens: 150,
      totalTokens: 450,
    });
  });
});
