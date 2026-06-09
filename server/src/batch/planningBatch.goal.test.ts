import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Channel } from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { type UxProposal, runPlanningBatch } from "./planningBatch.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

const proposals: UxProposal[] = [
  { title: "提案タイトル", reason: "改善理由", targetUrl: "/login" },
];

describe("runPlanningBatch: goal 駆動 dispatch (#284)", () => {
  let messageRepo: InMemoryMessageRepository;
  let appSettingRepo: AppSettingRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    messageRepo = new InMemoryMessageRepository();
    appSettingRepo = {
      findAll: vi.fn().mockResolvedValue([]),
      findByKey: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body>テスト</body></html>"),
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.restoreAllMocks();
  });

  it("goal.type='issue' のチャンネルが存在すれば処理を実行する（ID ハードコードなし）", async () => {
    const issueChannel: Channel = {
      id: "custom-issue-ch",
      label: "カスタム起票",
      type: "planning",
      goal: { type: "issue" },
    };
    const channelRepo = new InMemoryChannelRepository([issueChannel]);

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: vi.fn().mockResolvedValue(proposals),
    });

    expect(result).toHaveLength(1);
    expect(result[0].channel).toBe("custom-issue-ch");
  });

  it("goal.type='chat' のみの場合はスキップして空配列を返す", async () => {
    const chatChannel: Channel = {
      id: "chat-ch",
      label: "雑談",
      type: "zatsudan",
      goal: { type: "chat" },
    };
    const channelRepo = new InMemoryChannelRepository([chatChannel]);

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: vi.fn().mockResolvedValue(proposals),
    });

    expect(result).toHaveLength(0);
  });

  it("goal=issue チャンネルが複数あれば全て処理する", async () => {
    const channels: Channel[] = [
      { id: "issue-ch-1", label: "起票1", type: "planning", goal: { type: "issue" } },
      { id: "issue-ch-2", label: "起票2", type: "planning", goal: { type: "issue" } },
    ];
    const channelRepo = new InMemoryChannelRepository(channels);

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: vi.fn().mockResolvedValue(proposals),
    });

    expect(result).toHaveLength(2);
    const channelIds = result.map((r) => r.channel);
    expect(channelIds).toContain("issue-ch-1");
    expect(channelIds).toContain("issue-ch-2");
  });
});
