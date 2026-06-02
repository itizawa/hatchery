import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { getApiKey } from "./admin.js";
import { encrypt } from "../utils/crypto.js";

async function makeApp(appSettingRepo = new InMemoryAppSettingRepository()) {
  const userRepo = await InMemoryUserRepository.createWithTestUser();
  return createApp({
    messageRepository: new InMemoryMessageRepository(),
    userRepository: userRepo,
    appSettingRepository: appSettingRepo,
  });
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("GET /admin/settings", () => {
  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app).get("/admin/settings");
    expect(res.status).toBe(401);
  });

  it("認証済みの場合は 200 と設定一覧を返す（設定未登録時は空配列）", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.get("/admin/settings");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("CLAUDE_API_KEY が設定済みの場合はマスク表示で返す", async () => {
    const appSettingRepo = new InMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: "not-encrypted", updatedAt: new Date() },
    ]);
    const app = await makeApp(appSettingRepo);
    const agent = await loginAgent(app);
    const res = await agent.get("/admin/settings");
    expect(res.status).toBe(200);
    const claudeKey = (res.body as Array<{ key: string; maskedValue: string | null }>).find(
      (s) => s.key === "CLAUDE_API_KEY",
    );
    expect(claudeKey).toBeDefined();
  });
});

describe("PATCH /admin/settings", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await makeApp();
  });

  it("未認証の場合は 401 を返す", async () => {
    const res = await request(app)
      .patch("/admin/settings")
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-test" });
    expect(res.status).toBe(401);
  });

  it("key が空の場合は 400 を返す", async () => {
    const agent = await loginAgent(app);
    const res = await agent.patch("/admin/settings").send({ key: "", value: "sk-ant-test" });
    expect(res.status).toBe(400);
  });

  it("CLAUDE_API_KEY を設定すると 200 とマスク表示の設定を返す", async () => {
    const agent = await loginAgent(app);
    const res = await agent
      .patch("/admin/settings")
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-api03-test-key" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      key: "CLAUDE_API_KEY",
      maskedValue: expect.stringMatching(/\*{4}$/),
    });
  });

  it("value が空文字列でも 200 を返す（キーのリセット）", async () => {
    const agent = await loginAgent(app);
    const res = await agent.patch("/admin/settings").send({ key: "CLAUDE_API_KEY", value: "" });
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

  it("DB 未設定・env 未設定の場合は undefined を返す", async () => {
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

  it("DB 未設定・env 設定済みの場合は env 値を返す", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env-key";
    const repo = new InMemoryAppSettingRepository();
    expect(await getApiKey(repo)).toBe("sk-ant-env-key");
  });
});
