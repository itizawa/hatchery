import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

async function buildApp(channelMembershipRepository = new InMemoryChannelMembershipRepository()) {
  const userRepository = await InMemoryUserRepository.createWithTestUser();
  const app = createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository,
    channelMembershipRepository,
  });
  return { app, channelMembershipRepository };
}

async function login(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("POST /channels/:channelId/employees（追加・認証必須）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/channels/zatsudan/employees")
      .send({ employeeId: "haru" });
    expect(res.status).toBe(401);
  });

  it("認証済みなら 201 で追加され、GET に反映される", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/channels/zatsudan/employees").send({ employeeId: "haru" });
    expect(res.status).toBe(201);
    const list = await agent.get("/channels/zatsudan/employees");
    expect(list.status).toBe(200);
    expect(list.body).toContain("haru");
  });

  it("employeeId が空なら 400 を返す（Zod 検証）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/channels/zatsudan/employees").send({ employeeId: "" });
    expect(res.status).toBe(400);
  });

  it("1 人の Employee を複数チャンネルに追加できる（多対多）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    await agent.post("/channels/zatsudan/employees").send({ employeeId: "haru" });
    await agent.post("/channels/shigoto/employees").send({ employeeId: "haru" });
    const z = await agent.get("/channels/zatsudan/employees");
    const s = await agent.get("/channels/shigoto/employees");
    expect(z.body).toContain("haru");
    expect(s.body).toContain("haru");
  });
});

describe("DELETE /channels/:channelId/employees/:employeeId（除外・認証必須）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).delete("/channels/zatsudan/employees/haru");
    expect(res.status).toBe(401);
  });

  it("認証済みなら 204 で除外され、GET から消える", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    await agent.post("/channels/zatsudan/employees").send({ employeeId: "haru" });
    const res = await agent.delete("/channels/zatsudan/employees/haru");
    expect(res.status).toBe(204);
    const list = await agent.get("/channels/zatsudan/employees");
    expect(list.body).not.toContain("haru");
  });
});

describe("GET /channels/:channelId/employees（一覧・認証不要）", () => {
  it("所属が無ければ空配列を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/channels/zatsudan/employees");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
