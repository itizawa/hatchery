import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { getApiKey } from "./admin.js";
import { encrypt } from "../utils/crypto.js";

async function makeApp(appSettingRepo = new InMemoryAppSettingRepository(), role: "admin" | "member" = "admin", employeeRepository = new InMemoryEmployeeRepository()) {
  const userRepo = await InMemoryUserRepository.createWithTestUser(null, role);
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      appSettingRepository: appSettingRepo,
      employeeRepository,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("GET /api/admin/settings", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/api/admin/settings");
    expect(res.status).toBe(401);
  });

  it("admin ユーザーは 200 と設定一覧を返す（設定未登録時は空配列）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/settings");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("member ユーザーは 403 を返す (#136)", async () => {
    const app = await makeApp(new InMemoryAppSettingRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/settings");
    expect(res.status).toBe(403);
  });

  it("CLAUDE_API_KEY が設定済みの場合はマスク表示で返す", async () => {
    const appSettingRepo = new InMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: "not-encrypted", updatedAt: new Date() },
    ]);
    const app = await makeApp(appSettingRepo);
    const agent = await loginAgent(app);
    const res = await agent.get("/api/admin/settings");
    expect(res.status).toBe(200);
    const claudeKey = (res.body as Array<{ key: string; maskedValue: string | null }>).find(
      (s) => s.key === "CLAUDE_API_KEY",
    );
    expect(claudeKey).toBeDefined();
  });
});

describe("PATCH /api/admin/settings", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await makeApp();
  });

  it("未認証の場合は 401 を返す", async () => {
    const res = await request(app)
      .patch("/api/admin/settings")
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-test" });
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す (#136)", async () => {
    const memberApp = await makeApp(new InMemoryAppSettingRepository(), "member");
    const memberAgent = await loginAgent(memberApp);
    const res = await memberAgent.patch("/api/admin/settings").send({ key: "CLAUDE_API_KEY", value: "sk-ant-test" });
    expect(res.status).toBe(403);
  });

  it("key が空の場合は 400 を返す", async () => {
    const agent = await loginAgent(app);
    const res = await agent.patch("/api/admin/settings").send({ key: "", value: "sk-ant-test" });
    expect(res.status).toBe(400);
  });

  it("CLAUDE_API_KEY を設定すると 200 とマスク表示の設定を返す", async () => {
    const agent = await loginAgent(app);
    const res = await agent
      .patch("/api/admin/settings")
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-api03-test-key" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      key: "CLAUDE_API_KEY",
      maskedValue: expect.stringMatching(/\*{4}$/),
    });
  });

  it("value が空文字列でも 200 を返す（キーのリセット）", async () => {
    const agent = await loginAgent(app);
    const res = await agent.patch("/api/admin/settings").send({ key: "CLAUDE_API_KEY", value: "" });
    expect(res.status).toBe(200);
  });
});

describe("getApiKey", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    }
  });

  it("DB 未設定ゾnv 未設定の場合は undefined を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const repo = new InMemoryAppSettingRepository();
    expect(await getApiKey(repo)).toBeUndefined();
  });

  it("DB に設定済みの場合は復号した値を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const plaintext = "sk-ant-api03-test-key";
    const repo = new InMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: encrypt(plaintext), updatedAt: new Date() },
    ]);
    expect(await getApiKey(repo)).toBe(plaintext);
  });

  it("DB 未設定ゾnv 設定済みの場合は env 値を返す", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env-key";
    const repo = new InMemoryAppSettingRepository();
    expect(await getApiKey(repo)).toBe("sk-ant-env-key");
  });
});

describe("DELETE /api/admin/employees/:id (#218)", () => {
  async function makeAppWithEmployee(role: "admin" | "member" = "admin") {
    const userRepo = await InMemoryUserRepository.createWithTestUser(null, role);
    const employeeRepo = new InMemoryEmployeeRepository([
      { id: "emp-1", displayName: "田中 太郎", role: "エンジニア", isBot: true, personality: null },
    ]);
    return {
      app: createApp(
        await createTestDeps({
          userRepository: userRepo,
          employeeRepository: employeeRepo,
        }),
      ),
      employeeRepo,
    };
  }

  it("未認証の場合は 401 を返す", async () => {
    const { app } = await makeAppWithEmployee();
    const res = await request(app).delete("/api/admin/employees/emp-1");
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app } = await makeAppWithEmployee("member");
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/employees/emp-1");
    expect(res.status).toBe(403);
  });

  it("存在する Employee を論理削除すると 200 を返す", async () => {
    const { app } = await makeAppWithEmployee();
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/employees/emp-1");
    expect(res.status).toBe(200);
  });

  it("存在しない Employee の削除を試みると 404 を返す", async () => {
    const { app } = await makeAppWithEmployee();
    const agent = await loginAgent(app);
    const res = await agent.delete("/api/admin/employees/nonexistent");
    expect(res.status).toBe(404);
  });

  it("論理削除後に Employee の deletedAt が設定される", async () => {
    const { app, employeeRepo } = await makeAppWithEmployee();
    const agent = await loginAgent(app);
    await agent.delete("/api/admin/employees/emp-1");
    const employee = await employeeRepo.findDeletedById("emp-1");
    expect(employee?.deletedAt).toBeInstanceOf(Date);
  });
});

describe("POST /api/admin/employees (#217)", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/admin/employees")
      .send({ displayName: "新社員" });
    expect(res.status).toBe(401);
  });

  it("member ロールの場合は 403 を返す", async () => {
    const app = await makeApp(new InMemoryAppSettingRepository(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "新社員" });
    expect(res.status).toBe(403);
  });

  it("admin ロールで認証済みの場合 201 と作成した Employee を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "新社員" });
    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe("新社員");
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it("作成した Employee は isBot=true になる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "ボット社員" });
    expect(res.status).toBe(201);
    expect(res.body.isBot).toBe(true);
  });

  it("role を指定して作成できる", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "社員A", role: "エンジニア" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("エンジニア");
  });

  it("displayName が空なら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "" });
    expect(res.status).toBe(400);
  });

  it("displayName が 51 文字以上なら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({ displayName: "a".repeat(51) });
    expect(res.status).toBe(400);
  });

  it("displayName を省略した場合は 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees").send({});
    expect(res.status).toBe(400);
  });
});
