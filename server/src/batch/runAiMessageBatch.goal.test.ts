import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Channel } from "@hatchery/common";

import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryEmployeeRepository, type EmployeeRecord } from "../persistence/employeeRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { runAiMessageBatch } from "./runAiMessageBatch.js";

const bots: EmployeeRecord[] = [
  { id: "haru", displayName: "ハル", role: "ムードメーカー", isBot: true, personality: null },
];

const conversationJson = JSON.stringify([{ createdEmployeeId: "haru", text: "やあ" }]);

const chatChannel: Channel = { id: "ch-chat", label: "雑談", type: "zatsudan", goal: { type: "chat" } };
const issueChannel: Channel = { id: "ch-issue", label: "企画", type: "planning", goal: { type: "issue" } };

describe("runAiMessageBatch: goal 駆動 dispatch (#284)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.restoreAllMocks();
  });

  const buildDeps = (channels: Channel[]) => {
    const channelRepo = new InMemoryChannelRepository(channels);
    const messageRepo = new InMemoryMessageRepository();
    const membershipRepo = new InMemoryChannelMembershipRepository();
    const employeeRepo = new InMemoryEmployeeRepository(bots);
    const appSettingRepo = new InMemoryAppSettingRepository();
    const batchRunLogRepository = new InMemoryBatchRunLogRepository();
    return { channelRepo, messageRepo, membershipRepo, employeeRepo, appSettingRepo, batchRunLogRepository };
  };

  it("goal.type='chat' のチャンネルは処理対象になる", async () => {
    const deps = buildDeps([chatChannel]);
    await deps.membershipRepo.addMember("ch-chat", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });

  it("goal.type='issue' のチャンネルは runAiMessageBatch の対象外", async () => {
    const deps = buildDeps([issueChannel]);
    await deps.membershipRepo.addMember("ch-issue", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(generate).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it("goal.type='chat' と goal.type='issue' が混在する場合、chat のみ対象", async () => {
    const deps = buildDeps([chatChannel, issueChannel]);
    await deps.membershipRepo.addMember("ch-chat", "haru");
    await deps.membershipRepo.addMember("ch-issue", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    await runAiMessageBatch({ ...deps, generate });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("type='task' でも goal.type='chat' なら対象になる（goal が優先）", async () => {
    const taskChatChannel: Channel = { id: "ch-task", label: "仕事", type: "task", goal: { type: "chat" } };
    const deps = buildDeps([taskChatChannel]);
    await deps.membershipRepo.addMember("ch-task", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });
});
