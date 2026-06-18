import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

async function makeApp(role: "admin" | "member" = "admin", workerRepository = createInMemoryWorkerRepository()) {
  const userRepo = await createTestUserRepository(role);
  return createApp(
    createTestDeps({
      userRepository: userRepo,
      workerRepository,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("GET /api/admin/settings は廃止され 404 を返す (#662)", () => {
  it("管理者でも /api/admin/settings は 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/settings");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/settings は廃止され 404 を返す (#662)", () => {
  it("管理者でも /api/admin/settings への PATCH は 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.patch("/api/admin/settings").send({ key: "CLAUDE_API_KEY", value: "sk-ant-test" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/workers/:id (#218)", () => {
  async function makeAppWithWorker(role: "admin" | "member" = "admin") {
    const userRepo = await createTestUserRepository(role);
    const workerRepo = createInMemoryWorkerRepository([
      { id: "emp-1", displayName: "田中 太郎", role: "エンジニア", personality: null },
    ]);
    return {
      app: createApp(
        createTestDeps({
          userRepository: userRepo,
          workerRepository: workerRepo,
        }),
      ),
      workerRepo,
    };
  }

  it("未認証の場合は 401 を返す", async () => {
    const { app } = await makeAppWithWorker();
    const res = await request(app).delete("/api/admin/workers/emp-1");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app } = await makeAppWithWorker("member");
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/workers/emp-1");
    expect(res.status).toBe(403);
  });

  it("存在する Worker を論理削除すると 200 を返す", async () => {
    const { app } = await makeAppWithWorker();
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/workers/emp-1");
    expect(res.status).toBe(200);
  });

  it("存在しない Worker の削除を試みると 404 を返す", async () => {
    const { app } = await makeAppWithWorker();
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/workers/nonexistent");
    expect(res.status).toBe(404);
  });

  it("論理削除後に Worker の deletedAt が設定される", async () => {
    const { app, workerRepo } = await makeAppWithWorker();
    const agent = await loginAgent(app);
    await agent.delete("/api/admin/workers/emp-1");
    const worker = await workerRepo.findDeletedById("emp-1");
    expect(worker?.deletedAt).toBeInstanceOf(Date);
  });
});

describe("POST /api/admin/workers (#217)", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/admin/workers")
      .send({ displayName: "新社員" });
    expect(res.status).toBe(401);
  });

  it("member ロールの場合は 403 を返す", async () => {
    const app = await makeApp("member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({ displayName: "新社員" });
    expect(res.status).toBe(403);
  });

  it("admin ロールで認証済みの場合 201 と作成した Worker を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({ displayName: "新社員" });
    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe("新社員");
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  // #331: ADR-0020 後処理。Worker は AI 投稿者のみとなり isBot を撤廃した。
  it("作成した Worker は isBot フィールドを持たない（#331）", () => {
    return (async () => {
      const app = await makeApp();
      const agent = await loginAgent(app);
      const res = await agent.post("/api/admin/workers").send({ displayName: "ボット社員" });
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty("isBot");
    })();
  });

  it("role を指定して作成できる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({ displayName: "社員A", role: "エンジニア" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("エンジニア");
  });

  it("displayName が空なら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({ displayName: "" });
    expect(res.status).toBe(400);
  });

  it("displayName が 51 文字以上なら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({ displayName: "a".repeat(51) });
    expect(res.status).toBe(400);
  });

  it("displayName を省略した場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/workers").send({});
    expect(res.status).toBe(400);
  });
});

