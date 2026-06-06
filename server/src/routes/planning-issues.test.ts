import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

/** @octokit/rest をモックする */
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      create: vi.fn().mockResolvedValue({
        data: {
          number: 123,
          html_url: "https://github.com/owner/repo/issues/123",
        },
      }),
    },
  })),
}));

async function makeApp(messageRepo = new InMemoryMessageRepository()) {
  const userRepo = await InMemoryUserRepository.createWithTestUser();
  return createApp({
    messageRepository: messageRepo,
    userRepository: userRepo,
  });
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/auth/login").send({ id: "testuser", password: "testpass" });
  return agent;
}

describe("POST /channels/:channelId/messages/:messageId/create-issue (#76)", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/channels/kikaku/messages/msg-1/create-issue")
      .send({});
    expect(res.status).toBe(401);
  });

  it("GITHUB_TOKEN が未設定の場合は 500 を返す", async () => {
    const env = { ...process.env };
    delete env["GITHUB_TOKEN"];
    process.env = env;

    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/channels/kikaku/messages/msg-1/create-issue")
      .send({});
    expect(res.status).toBe(500);
  });

  it("メッセージが存在しない場合は 404 を返す", async () => {
    process.env = {
      ...process.env,
      GITHUB_TOKEN: "ghp_test",
      GITHUB_OWNER: "owner",
      GITHUB_REPO: "repo",
    };

    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/channels/kikaku/messages/non-existent-id/create-issue")
      .send({});
    expect(res.status).toBe(404);
  });

  it("正常ケースで 201 と issueNumber / issueUrl を返す", async () => {
    process.env = {
      ...process.env,
      GITHUB_TOKEN: "ghp_test",
      GITHUB_OWNER: "owner",
      GITHUB_REPO: "repo",
    };

    const messageRepo = new InMemoryMessageRepository();
    const created = await messageRepo.createPlanningMessage({
      speaker: "ai-planner",
      channel: "kikaku",
      text: "【UX提案】ログインボタンの色を改善する",
      proposalTitle: "ログインボタンの色を改善する",
      proposalReason: "コントラスト比が WCAG 基準を下回っている",
      proposalTargetUrl: "/login",
    });

    const app = await makeApp(messageRepo);
    const agent = await loginAgent(app);
    const res = await agent
      .post(`/channels/kikaku/messages/${created.id}/create-issue`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("issueNumber", 123);
    expect(res.body).toHaveProperty("issueUrl");
  });

  it("起票後にメッセージの issueNumber / issueUrl が更新される", async () => {
    process.env = {
      ...process.env,
      GITHUB_TOKEN: "ghp_test",
      GITHUB_OWNER: "owner",
      GITHUB_REPO: "repo",
    };

    const messageRepo = new InMemoryMessageRepository();
    const created = await messageRepo.createPlanningMessage({
      speaker: "ai-planner",
      channel: "kikaku",
      text: "【UX提案】ナビゲーションを改善する",
      proposalTitle: "ナビゲーションを改善する",
      proposalReason: "ナビゲーションが分かりにくい",
      proposalTargetUrl: "/",
    });

    const app = await makeApp(messageRepo);
    const agent = await loginAgent(app);
    await agent
      .post(`/channels/kikaku/messages/${created.id}/create-issue`)
      .send({});

    const messages = await messageRepo.listByChannel("kikaku");
    const updated = messages.find((m) => m.id === created.id);
    expect(updated?.issueNumber).toBe(123);
    expect(updated?.issueUrl).toBeDefined();
  });
});
