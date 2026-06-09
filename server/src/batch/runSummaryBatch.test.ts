import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Channel } from "@hatchery/common";

import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { runSummaryBatch } from "./runSummaryBatch.js";

// InMemoryMessageRepository は createdAt を new Date(0) で採番するため、当日判定の基準日も
// new Date(0)（1970-01-01）に揃えて「当日メッセージ」を成立させる。
const DAY = new Date(0);

describe("runSummaryBatch (#53)", () => {
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
    const appSettingRepo = new InMemoryAppSettingRepository();
    return { channelRepo, messageRepo, appSettingRepo };
  };

  it("当日メッセージがあるチャンネルのみ要約して updateSummary する", async () => {
    const deps = buildDeps([
      { id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } },
      { id: "shigoto", label: "仕事", type: "task", goal: { type: "chat" } },
    ]);
    await deps.messageRepo.createMany([{ createdEmployeeId: "haru", channel: "zatsudan", text: "やあ" }]);

    const summarize = vi.fn().mockResolvedValue("今日のあらすじ");
    const updated = await runSummaryBatch({ ...deps, summarize, now: DAY });

    expect(updated).toEqual(["zatsudan"]);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect((await deps.channelRepo.getSummary("zatsudan"))?.summary).toBe("今日のあらすじ");
    // 当日メッセージが無い shigoto は要約しない
    expect((await deps.channelRepo.getSummary("shigoto"))?.summary).toBeNull();
  });

  it("API キーが未設定ならスキップして空配列を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } }]);
    await deps.messageRepo.createMany([{ createdEmployeeId: "haru", channel: "zatsudan", text: "やあ" }]);
    const summarize = vi.fn().mockResolvedValue("x");

    expect(await runSummaryBatch({ ...deps, summarize, now: DAY })).toEqual([]);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("あるチャンネルの要約が失敗しても次チャンネルを継続する", async () => {
    const deps = buildDeps([
      { id: "z1", label: "雑談１", type: "zatsudan", goal: { type: "chat" } },
      { id: "z2", label: "雑談２", type: "zatsudan", goal: { type: "chat" } },
    ]);
    await deps.messageRepo.createMany([
      { createdEmployeeId: "haru", channel: "z1", text: "a" },
      { createdEmployeeId: "haru", channel: "z2", text: "b" },
    ]);

    let call = 0;
    const summarize = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error("api error"));
      return Promise.resolve("z2 あらすじ");
    });

    const updated = await runSummaryBatch({ ...deps, summarize, now: DAY });
    expect(updated).toEqual(["z2"]);
    expect((await deps.channelRepo.getSummary("z1"))?.summary).toBeNull();
    expect((await deps.channelRepo.getSummary("z2"))?.summary).toBe("z2 あらすじ");
  });
});
