import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(
  logRepo = new InMemoryBatchRunLogRepository(),
  role: "admin" | "member" = "admin",
) {
  const userRepo = await InMemoryUserRepository.createWithTestUser(undefined, role);
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      batchRunLogRepository: logRepo,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("GET /api/admin/batch-logs", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/admin/batch-logs");
    expect(res.status).toBe(401);
  });

  it("member ロールの場合は 403 を返す（#136）", async () => {
    const app = await makeApp(new InMemoryBatchRunLogRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/batch-logs");
    expect(res.status).toBe(403);
  });

  it("認証済みの場合は 200 と空配列を返す（ログ未登録時）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/batch-logs");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("認証済みの場合は 200 とログ一覧（executedAt 降順）を返す", async () => {
    const logRepo = new InMemoryBatchRunLogRepository();
    await logRepo.create({ status: "success", messageCount: 3, errorMessage: null, errorCode: null });
    await logRepo.create({ status: "failure", messageCount: 0, errorMessage: "API error", errorCode: "ERR_API" });
    const app = await makeApp(logRepo);
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/batch-logs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBe(2);
    const first = (res.body as Array<{ status: string; messageCount: number }>)[0];
    expect(first?.status).toBe("failure");
  });
});
