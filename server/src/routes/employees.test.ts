import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const EMPLOYEE_ID = "emp-testworker";

async function buildApp(employeeRepository = new InMemoryEmployeeRepository()) {
  const userRepository = await InMemoryUserRepository.createWithTestUser(null, "admin");
  const app = createApp(
    await createTestDeps({
      userRepository,
      employeeRepository,
    }),
  );
  return { app, employeeRepository };
}

async function buildAppWithMember(employeeRepository = new InMemoryEmployeeRepository()) {
  const userRepository = await InMemoryUserRepository.createWithTestUser(null, "member");
  const app = createApp(
    await createTestDeps({
      userRepository,
      employeeRepository,
    }),
  );
  return { app, employeeRepository };
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

async function loginAsMember(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("PATCH /api/employees/:id（admin のみ更新可 / #181）", () => {
  describe("認証", () => {
    it("①未認証だと 401 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const res = await request(app)
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ displayName: "新名前" });
      expect(res.status).toBe(401);
    });
  });

  describe("認可", () => {
    it("②admin は更新できて 200 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ displayName: "Updated Worker" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("Updated Worker");
    });

    it("③member は更新できず 403 を返す", async () => {
      const { app } = await buildAppWithMember(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsMember(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ displayName: "試み" });
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("admin が displayName / role / personality を更新すると 200 で更新後の Employee を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ displayName: "新表示名", role: "リーダー", personality: "陽気な性格" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("新表示名");
      expect(res.body.role).toBe("リーダー");
      expect(res.body.personality).toBe("陽気な性格");
    });

    it("role のみ更新できる", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: "旧役職", personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ role: "新役職" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("新役職");
    });

    it("personality を省略しても 200（他フィールドのみ更新）", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Old Name", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ displayName: "New Name" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("New Name");
    });
  });

  describe("存在しないリソース", () => {
    it("④不存在 Employee への更新は 404 を返す", async () => {
      const { app } = await buildApp(new InMemoryEmployeeRepository([]));
      const agent = await loginAsAdmin(app);
      const res = await agent.patch("/api/employees/non-existent-id").send({ displayName: "test" });
      expect(res.status).toBe(404);
    });
  });

  describe("バリデーション", () => {
    it("⑤displayName が 51 文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ displayName: "a".repeat(51) });
      expect(res.status).toBe(400);
    });

    it("personality が 501 文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ personality: "a".repeat(501) });
      expect(res.status).toBe(400);
    });

    it("displayName が空文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: EMPLOYEE_ID, displayName: "Worker", isBot: true, role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ displayName: "" });
      expect(res.status).toBe(400);
    });
  });
});

describe("GET /api/employees（Bot Employee 一覧 / #240）", () => {
  it("認証不要で 200 を返す", async () => {
    const { app } = await buildApp(
      new InMemoryEmployeeRepository([
        { id: "bot1", displayName: "Bot", role: "役職", isBot: true, personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(200);
  });

  it("isBot=true の Employee のみを配列で返す", async () => {
    const { app } = await buildApp(
      new InMemoryEmployeeRepository([
        { id: "bot1", displayName: "BotA", role: null, isBot: true, personality: null, imageUrl: null },
        { id: "user1", displayName: "UserB", role: null, isBot: false, personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual(["bot1"]);
  });

  it("Bot が存在しない場合は空配列を返す", async () => {
    const { app } = await buildApp(new InMemoryEmployeeRepository([]));
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
