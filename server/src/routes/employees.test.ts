import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

const EMPLOYEE_ID = "emp-testuser";

async function buildApp(employeeRepository = new InMemoryEmployeeRepository()) {
  const userRepository = await InMemoryUserRepository.createWithTestUser(EMPLOYEE_ID);
  const app = createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository,
    employeeRepository,
  });
  return { app, employeeRepository };
}

async function login(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("PATCH /api/employees/:id（Employee 更新 / #38）", () => {
  describe("認証", () => {
    it("未ログインだと 401 を返す", async () => {
      const { app } = await buildApp();
      const res = await request(app)
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ personality: "明るい" });
      expect(res.status).toBe(401);
    });
  });

  describe("認可", () => {
    it("他ユーザーの Employee を更新しようとすると 403 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          { id: "other-emp", displayName: "Other", isBot: false, role: null, personality: null },
        ]),
      );
      const agent = await login(app);
      const res = await agent.patch("/api/employees/other-emp").send({ personality: "test" });
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("自分の Employee を更新すると 200 で更新後の Employee を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          {
            id: EMPLOYEE_ID,
            displayName: "Test Employee",
            isBot: false,
            role: null,
            personality: null,
          },
        ]),
      );
      const agent = await login(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ personality: "明るく積極的" });
      expect(res.status).toBe(200);
      expect(res.body.personality).toBe("明るく積極的");
      expect(res.body.id).toBe(EMPLOYEE_ID);
    });

    it("personality を省略しても 200（他フィールドのみ更新）", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          {
            id: EMPLOYEE_ID,
            displayName: "Old Name",
            isBot: false,
            role: null,
            personality: null,
          },
        ]),
      );
      const agent = await login(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ displayName: "New Name" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("New Name");
    });

    it("role のみ更新できる", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          {
            id: EMPLOYEE_ID,
            displayName: "Test",
            isBot: false,
            role: "旧役職",
            personality: null,
          },
        ]),
      );
      const agent = await login(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ role: "新役職" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("新役職");
    });
  });

  describe("バリデーション", () => {
    it("personality が 501 文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          {
            id: EMPLOYEE_ID,
            displayName: "Test",
            isBot: false,
            role: null,
            personality: null,
          },
        ]),
      );
      const agent = await login(app);
      const res = await agent
        .patch(`/api/employees/${EMPLOYEE_ID}`)
        .send({ personality: "a".repeat(501) });
      expect(res.status).toBe(400);
    });

    it("displayName が空文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        new InMemoryEmployeeRepository([
          {
            id: EMPLOYEE_ID,
            displayName: "Test",
            isBot: false,
            role: null,
            personality: null,
          },
        ]),
      );
      const agent = await login(app);
      const res = await agent.patch(`/api/employees/${EMPLOYEE_ID}`).send({ displayName: "" });
      expect(res.status).toBe(400);
    });
  });
});
