import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

async function makeApp(batchRunLogRepo = new InMemoryBatchRunLogRepository()) {
  const userRepo = await InMemoryUserRepository.createWithTestUser();
  return createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository: userRepo,
    batchRunLogRepository: batchRunLogRepo,
  });
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("GET /batch-logs", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/batch-logs");
    expect(res.status).toBe(401);
  });

  it("認証済みの場合は 200 と空配列を返す（ログ未登録時）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/batch-logs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("登録済みのログが一覧に含まれる", async () => {
    const batchRunLogRepo = new InMemoryBatchRunLogRepository();
    await batchRunLogRepo.create({ status: "success", messageCount: 5 });
    await batchRunLogRepo.create({ status: "failure", errorMessage: "API error" });

    const app = await makeApp(batchRunLogRepo);
    const agent = await loginAgent(app);
    const res = await agent.get("/batch-logs");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const body = res.body as Array<{ status: string; messageCount: number | null }>;
    expect(body[0]!.status).toBe("failure");
    expect(body[1]!.status).toBe("success");
    expect(body[1]!.messageCount).toBe(5);
  });
});
