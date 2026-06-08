import { describe, expect, it, vi } from "vitest";

import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { generateAiResponsesForChannel } from "./generateAiResponsesForChannel.js";

const BASE_TIME = new Date("2026-01-01T12:00:00.000Z");

const BOT_EMPLOYEE = { id: "bot1", displayName: "Bot", isBot: true, role: null, personality: null };
const HUMAN_EMPLOYEE = { id: "human1", displayName: "人間", isBot: false, role: null, personality: null };

describe("generateAiResponsesForChannel", () => {
  it("AI キー未設定のとき何も保存せず void を返す", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const membershipRepo = new InMemoryChannelMembershipRepository();
    const employeeRepo = new InMemoryEmployeeRepository([BOT_EMPLOYEE]);
    const appSettingRepo = new InMemoryAppSettingRepository();
    await membershipRepo.addMember("ch1", "bot1");

    const prevApiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await generateAiResponsesForChannel("ch1", "雑談", BASE_TIME, {
      membershipRepo,
      employeeRepo,
      messageRepo,
      appSettingRepo,
    });

    if (prevApiKey !== undefined) process.env.ANTHROPIC_API_KEY = prevApiKey;

    const saved = await messageRepo.list();
    expect(saved).toHaveLength(0);
  });

  it("AI 生成成功 → 未来の postedAt で複数メッセージを保存する", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const membershipRepo = new InMemoryChannelMembershipRepository();
    const employeeRepo = new InMemoryEmployeeRepository([BOT_EMPLOYEE]);
    const appSettingRepo = new InMemoryAppSettingRepository();
    await membershipRepo.addMember("ch1", "bot1");

    const stubGenerate = vi.fn().mockResolvedValue(
      JSON.stringify([{ createdEmployeeId: "bot1", text: "こんにちは！" }]),
    );

    process.env.ANTHROPIC_API_KEY = "test-key";
    await generateAiResponsesForChannel("ch1", "雑談", BASE_TIME, {
      membershipRepo,
      employeeRepo,
      messageRepo,
      appSettingRepo,
      generate: stubGenerate,
    });
    delete process.env.ANTHROPIC_API_KEY;

    const saved = await messageRepo.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].createdEmployeeId).toBe("bot1");
    expect(saved[0].text).toBe("こんにちは！");
    // postedAt は BASE_TIME より未来
    expect(saved[0].postedAt.getTime()).toBeGreaterThan(BASE_TIME.getTime());
  });

  it("生成関数が例外を投げてもエラーを握りつぶし void を返す（ユーザー投稿は守る）", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const membershipRepo = new InMemoryChannelMembershipRepository();
    const employeeRepo = new InMemoryEmployeeRepository([BOT_EMPLOYEE]);
    const appSettingRepo = new InMemoryAppSettingRepository();
    await membershipRepo.addMember("ch1", "bot1");

    const failGenerate = vi.fn().mockRejectedValue(new Error("API Error"));

    process.env.ANTHROPIC_API_KEY = "test-key";
    await expect(
      generateAiResponsesForChannel("ch1", "雑談", BASE_TIME, {
        membershipRepo,
        employeeRepo,
        messageRepo,
        appSettingRepo,
        generate: failGenerate,
      }),
    ).resolves.toBeUndefined();
    delete process.env.ANTHROPIC_API_KEY;

    const saved = await messageRepo.list();
    expect(saved).toHaveLength(0);
  });

  it("ボットが所属していないチャンネルでは何も保存しない", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const membershipRepo = new InMemoryChannelMembershipRepository();
    const employeeRepo = new InMemoryEmployeeRepository([HUMAN_EMPLOYEE]);
    const appSettingRepo = new InMemoryAppSettingRepository();
    await membershipRepo.addMember("ch1", "human1");

    process.env.ANTHROPIC_API_KEY = "test-key";
    await generateAiResponsesForChannel("ch1", "雑談", BASE_TIME, {
      membershipRepo,
      employeeRepo,
      messageRepo,
      appSettingRepo,
    });
    delete process.env.ANTHROPIC_API_KEY;

    const saved = await messageRepo.list();
    expect(saved).toHaveLength(0);
  });
});
