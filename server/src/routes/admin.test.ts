import { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

/** テスト用認証済みセッションを取得するヘルパー */
async function loginAs(app: Express, id: string, password: string): Promise<string[]> {
  const res = await request(app).post("/auth/login").send({ id, password });
  const cookies = res.headers["set-cookie"] as string[] | string | undefined;
  if (!cookies) return [];
  return Array.isArray(cookies) ? cookies : [cookies];
}

describe("GET /admin/settings", () => {
  let app: Express;
  let cookies: string[];

  beforeEach(async () => {
    const userRepo = InMemoryUserRepository.withTestUser();
    const appSettingRepo = new InMemoryAppSettingRepository();
    app = createApp({
      messageRepository: new InMemoryMessageRepository(),
      userRepository: userRepo,
      appSettingRepository: appSettingRepo,
    });
    cookies = await loginAs(app, "testuser", "testpass");
  });

  it("未認証の場合は 401 を返す", async () => {
    const res = await request(app).get("/admin/settings");
    expect(res.status).toBe(401);
  });

  it("認証済みの場合は 200 と設定一覧を返す（設定未登録時は空配列）", async () => {
    const res = await request(app)
      .get("/admin/settings")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("CLAUDE_API_KEY が設定済みの場合はマスク表示で返す", async () => {
    const userRepo = InMemoryUserRepository.withTestUser();
    const appSettingRepo = new InMemoryAppSettingRepository([
      { key: "CLAUDE_API_KEY", value: "encrypted-value", updatedAt: new Date() },
    ]);
    const appWithSetting = createApp({
      messageRepository: new InMemoryMessageRepository(),
      userRepository: userRepo,
      appSettingRepository: appSettingRepo,
    });
    const sessionCookies = await loginAs(appWithSetting, "testuser", "testpass");

    const res = await request(appWithSetting)
      .get("/admin/settings")
      .set("Cookie", sessionCookies);
    expect(res.status).toBe(200);
    const claudeKey = (res.body as Array<{ key: string; maskedValue: string | null }>).find(
      (s) => s.key === "CLAUDE_API_KEY",
    );
    expect(claudeKey).toBeDefined();
    expect(claudeKey?.maskedValue).toMatch(/\*{4}$/);
  });
});

describe("PATCH /admin/settings", () => {
  let app: Express;
  let cookies: string[];

  beforeEach(async () => {
    const userRepo = InMemoryUserRepository.withTestUser();
    const appSettingRepo = new InMemoryAppSettingRepository();
    app = createApp({
      messageRepository: new InMemoryMessageRepository(),
      userRepository: userRepo,
      appSettingRepository: appSettingRepo,
    });
    cookies = await loginAs(app, "testuser", "testpass");
  });

  it("未認証の場合は 401 を返す", async () => {
    const res = await request(app)
      .patch("/admin/settings")
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-test" });
    expect(res.status).toBe(401);
  });

  it("key が空の場合は 400 を返す", async () => {
    const res = await request(app)
      .patch("/admin/settings")
      .set("Cookie", cookies)
      .send({ key: "", value: "sk-ant-test" });
    expect(res.status).toBe(400);
  });

  it("CLAUDE_API_KEY を設定すると 200 とマスク表示の設定を返す", async () => {
    const res = await request(app)
      .patch("/admin/settings")
      .set("Cookie", cookies)
      .send({ key: "CLAUDE_API_KEY", value: "sk-ant-api03-test-key" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      key: "CLAUDE_API_KEY",
      maskedValue: expect.stringMatching(/\*{4}$/),
    });
  });

  it("value が空文字列でも 200 を返す（キーのリセット）", async () => {
    const res = await request(app)
      .patch("/admin/settings")
      .set("Cookie", cookies)
      .send({ key: "CLAUDE_API_KEY", value: "" });
    expect(res.status).toBe(200);
  });
});
