import { describe, expect, it, vi } from "vitest";

import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { type UxProposal, runPlanningBatch } from "./planningBatch.js";

/** fetch をモックする */
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("<html><body>test</body></html>"),
});

const proposals: UxProposal[] = [
  { title: "テスト提案", reason: "テスト理由", targetUrl: "/" },
];

const sampleAppSettingRepo: AppSettingRepository = {
  findAll: vi.fn().mockResolvedValue([]),
  findByKey: vi.fn().mockResolvedValue(null),
  upsert: vi.fn(),
};

describe("runPlanningBatch トークン使用量記録（#153）", () => {
  it("generateProposalsWithUsage を注入すれば usage が tokenUsageLogRepository に記録される", async () => {
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key" };
    const channelRepo = new InMemoryChannelRepository();
    const messageRepo = new InMemoryMessageRepository();
    const tokenUsageRepo = new InMemoryTokenUsageLogRepository();

    // usage を返す generateProposalsWithUsage を注入する
    const mockGenerateWithUsage = vi.fn().mockResolvedValue({
      proposals,
      usage: { inputTokens: 150, outputTokens: 75, model: "claude-haiku-4-5" },
    });

    await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo: sampleAppSettingRepo,
      tokenUsageLogRepository: tokenUsageRepo,
      generateProposalsWithUsage: mockGenerateWithUsage,
    });

    const logs = await tokenUsageRepo.findRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].inputTokens).toBe(150);
    expect(logs[0].outputTokens).toBe(75);
    expect(logs[0].model).toBe("claude-haiku-4-5");
  });

  it("tokenUsageLogRepository がなければ usage 記録をスキップして正常終了する", async () => {
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key" };
    const channelRepo = new InMemoryChannelRepository();
    const messageRepo = new InMemoryMessageRepository();

    const mockGenerateWithUsage = vi.fn().mockResolvedValue({
      proposals,
      usage: { inputTokens: 100, outputTokens: 50, model: "claude-haiku-4-5" },
    });

    // エラーなく完了することを確認
    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo: sampleAppSettingRepo,
      // tokenUsageLogRepository なし
      generateProposalsWithUsage: mockGenerateWithUsage,
    });

    expect(result).toHaveLength(1);
  });

  it("旧来の generateProposals injection も引き続き動作する（後方互換）", async () => {
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key" };
    const channelRepo = new InMemoryChannelRepository();
    const messageRepo = new InMemoryMessageRepository();

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo: sampleAppSettingRepo,
      generateProposals: vi.fn().mockResolvedValue(proposals),
    });

    expect(result).toHaveLength(1);
  });
});
