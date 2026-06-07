import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

async function buildApp(
  channelMembershipRepository = new InMemoryChannelMembershipRepository(),
  channelRepository = new InMemoryChannelRepository(),
  messageRepository = new InMemoryMessageRepository(),
  userRepository?: InMemoryUserRepository,
) {
  const resolvedUserRepository = userRepository ?? (await InMemoryUserRepository.createWithTestUser());
  const app = createApp({
    messageRepository,
    userRepository: resolvedUserRepository,
    channelMembershipRepository,
    channelRepository,
  });
  return { app, channelMembershipRepository, channelRepository, messageRepository };
}

async function login(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("POST /api/channels/:channelId/employees（追加・認証必須）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/api/channels/zatsudan/employees")
      .send({ employeeId: "haru" });
    expect(res.status).toBe(401);
  });

  it("認証済みなら 201 で追加され、GET に反映される", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/api/channels/zatsudan/employees").send({ employeeId: "haru" });
    expect(res.status).toBe(201);
    const list = await agent.get("/api/channels/zatsudan/employees");
    expect(list.status).toBe(200);
    expect(list.body).toContain("haru");
  });

  it("employeeId が空なら 400 を返す（Zod 検証）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/api/channels/zatsudan/employees").send({ employeeId: "" });
    expect(res.status).toBe(400);
  });

  it("1 人の Employee を複数チャンネルに追加できる（多対多）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    await agent.post("/api/channels/zatsudan/employees").send({ employeeId: "haru" });
    await agent.post("/api/channels/shigoto/employees").send({ employeeId: "haru" });
    const z = await agent.get("/api/channels/zatsudan/employees");
    const s = await agent.get("/api/channels/shigoto/employees");
    expect(z.body).toContain("haru");
    expect(s.body).toContain("haru");
  });
});

describe("DELETE /api/channels/:channelId/employees/:employeeId（除外・認証必須）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).delete("/api/channels/zatsudan/employees/haru");
    expect(res.status).toBe(401);
  });

  it("認証済みなら 204 で除外され、GET から消える", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    await agent.post("/api/channels/zatsudan/employees").send({ employeeId: "haru" });
    const res = await agent.delete("/api/channels/zatsudan/employees/haru");
    expect(res.status).toBe(204);
    const list = await agent.get("/api/channels/zatsudan/employees");
    expect(list.body).not.toContain("haru");
  });
});

describe("GET /api/channels/:channelId/employees（一覧・認証不要）", () => {
  it("所属が無ければ空配列を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/channels/zatsudan/employees");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("PATCH /api/channels/:id（チャンネル更新・認証必須・#54）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).patch("/api/channels/zatsudan").send({ label: "新しい名前" });
    expect(res.status).toBe(401);
  });

  it("ログイン済みで有効な label なら 200 と更新後チャンネルを返す", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ label: "更新後ラベル" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "zatsudan", label: "更新後ラベル" });
  });

  it("label が空文字なら 400 を返す", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ label: "" });
    expect(res.status).toBe(400);
  });

  it("存在しないチャンネル ID なら 404 を返す", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/nonexistent").send({ label: "何か" });
    expect(res.status).toBe(404);
  });

  it("type のみを指定してタイプを更新できる（#54）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ type: "task" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "zatsudan", type: "task" });
  });

  it("label と type の両方を指定して更新できる（#54）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ label: "新名前", type: "task" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "zatsudan", label: "新名前", type: "task" });
  });

  it("label も type も指定しないと 400 を返す（#54）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({});
    expect(res.status).toBe(400);
  });

  it("label が 51 文字以上なら 400 を返す（#91）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ label: "a".repeat(51) });
    expect(res.status).toBe(400);
  });

  it("label が 50 文字ちょうどなら 200 を返す（#91）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.patch("/api/channels/zatsudan").send({ label: "a".repeat(50) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "zatsudan", label: "a".repeat(50) });
  });
});

describe("GET /channels（一覧・認証不要・#47 / #54）", () => {
  it("認証不要で 200 と既定チャンネル配列を返す（type フィールド含む）", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/channels");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "zatsudan", label: "雑談", type: "zatsudan" },
      { id: "shigoto", label: "仕事", type: "task" },
      { id: "kikaku", label: "企画", type: "planning" },
    ]);
  });
});

describe("POST /channels（作成・認証必須・#47 / #54）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/api/channels").send({ label: "#新規" });
    expect(res.status).toBe(401);
  });

  it("ログイン済みで有効な label なら 201 と生成チャンネルを返す（type=zatsudan がデフォルト）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/api/channels").send({ label: "#新規" });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe("#新規");
    expect(res.body.type).toBe("zatsudan");
    expect(typeof res.body.id).toBe("string");
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it("type='task' を指定して作成できる（#54）", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/api/channels").send({ label: "仕事2", type: "task" });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe("仕事2");
    expect(res.body.type).toBe("task");
  });

  it("label が空文字なら 400 を返す", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const res = await agent.post("/api/channels").send({ label: "" });
    expect(res.status).toBe(400);
  });

  it("作成したチャンネルは GET /channels の一覧に含まれる", async () => {
    const { app } = await buildApp();
    const agent = await login(app);
    const created = await agent.post("/api/channels").send({ label: "企画" });
    const list = await request(app).get("/api/channels");
    expect(list.body).toContainEqual({ id: created.body.id, label: "企画", type: "zatsudan" });
  });
});

describe("POST /api/channels/:channelId/messages（メッセージ投稿・認証必須・#48）", () => {
  it("未ログインだと 401 を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/api/channels/zatsudan/messages")
      .send({ text: "こんにちは" });
    expect(res.status).toBe(401);
  });

  it("employeeId なし（未紐づけ）のユーザーで 400 を返す", async () => {
    const userRepository = await InMemoryUserRepository.createWithTestUser(null);
    const { app } = await buildApp(undefined, undefined, undefined, userRepository);
    const agent = await login(app);
    const res = await agent.post("/api/channels/zatsudan/messages").send({ text: "こんにちは" });
    expect(res.status).toBe(400);
  });

  it("employeeId ありのユーザーで有効な text なら 201 と作成メッセージを返す", async () => {
    const messageRepository = new InMemoryMessageRepository();
    const userRepository = await InMemoryUserRepository.createWithTestUser("emp1");
    const { app } = await buildApp(undefined, undefined, messageRepository, userRepository);
    const agent = await login(app);
    const res = await agent.post("/api/channels/zatsudan/messages").send({ text: "こんにちは！" });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe("こんにちは！");
    expect(res.body.speaker).toBe("emp1");
    expect(res.body.channel).toBe("zatsudan");
    expect(res.body.id).toBeTruthy();
  });

  it("text が空文字なら 400 を返す", async () => {
    const userRepository = await InMemoryUserRepository.createWithTestUser("emp1");
    const { app } = await buildApp(undefined, undefined, undefined, userRepository);
    const agent = await login(app);
    const res = await agent.post("/api/channels/zatsudan/messages").send({ text: "" });
    expect(res.status).toBe(400);
  });

  it("存在しないチャンネル ID なら 404 を返す", async () => {
    const userRepository = await InMemoryUserRepository.createWithTestUser("emp1");
    const { app } = await buildApp(undefined, undefined, undefined, userRepository);
    const agent = await login(app);
    const res = await agent.post("/api/channels/nonexistent/messages").send({ text: "こんにちは" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/channels/:channelId/messages（メッセージ一覧・認証不要・#48）", () => {
  it("認証不要で 200 と空配列を返す", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/channels/zatsudan/messages");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST 後に GET するとそのチャンネルのメッセージが含まれる", async () => {
    const messageRepository = new InMemoryMessageRepository();
    const userRepository = await InMemoryUserRepository.createWithTestUser("emp1");
    const { app } = await buildApp(undefined, undefined, messageRepository, userRepository);
    const agent = await login(app);
    await agent.post("/api/channels/zatsudan/messages").send({ text: "テストメッセージ" });
    const res = await request(app).get("/api/channels/zatsudan/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toBe("テストメッセージ");
    expect(res.body[0].channel).toBe("zatsudan");
  });

  it("別チャンネルのメッセージは含まれない", async () => {
    const messageRepository = new InMemoryMessageRepository();
    const userRepository = await InMemoryUserRepository.createWithTestUser("emp1");
    const { app } = await buildApp(undefined, undefined, messageRepository, userRepository);
    const agent = await login(app);
    await agent.post("/api/channels/zatsudan/messages").send({ text: "雑談メッセージ" });
    const res = await request(app).get("/api/channels/shigoto/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
