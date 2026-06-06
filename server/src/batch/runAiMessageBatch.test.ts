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
  { id: "ken", displayName: "ケン", role: "ベテラン", isBot: true, personality: null },
  { id: "user1", displayName: "ユーザー", role: null, isBot: false, personality: null },
];

const conversationJson = JSON.stringify([
  { speaker: "haru", text: "やあ" },
  { speaker: "ken", text: "よろしく" },
  { speaker: "user1", text: "（人間は喋らないはず）" },
]);

describe("runAiMessageBatch (#53)", () => {
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

  it("zatsudan チャンネルのみ対象にし、isBot の発言だけを保存する", async () => {
    const deps = buildDeps([
      { id: "zatsudan", label: "雑談", type: "zatsudan" },
      { id: "shigoto", label: "仕事", type: "task" },
      { id: "kikaku", label: "企画", type: "planning" },
    ]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    await deps.membershipRepo.addMember("zatsudan", "ken");
    await deps.membershipRepo.addMember("zatsudan", "user1");
    // task / planning にも所属者を置くが、対象外なので生成されない
    await deps.membershipRepo.addMember("shigoto", "haru");

    const generate = vi.fn().mockResolvedValue(conversationJson);
    const saved = await runAiMessageBatch({ ...deps, generate });

    // 生成は zatsudan の 1 回だけ
    expect(generate).toHaveBeenCalledTimes(1);
    // user1（非 bot）は除外され 2 件だけ保存
    expect(saved).toHaveLength(2);
    const zatsudanMsgs = await deps.messageRepo.listByChannel("zatsudan");
    expect(zatsudanMsgs.map((m) => m.speaker)).toEqual(["haru", "ken"]);
    // 対象外チャンネルには何も保存されない
    expect(await deps.messageRepo.listByChannel("shigoto")).toHaveLength(0);
  });

  it("API キーが未設定なら何も生成せず空配列を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan" }]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(saved).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("あるチャンネルの生成が失敗してもリトライせず次チャンネルを継続する", async () => {
    const deps = buildDeps([
      { id: "z1", label: "雑談1", type: "zatsudan" },
      { id: "z2", label: "雑談2", type: "zatsudan" },
    ]);
    await deps.membershipRepo.addMember("z1", "haru");
    await deps.membershipRepo.addMember("z2", "haru");

    let call = 0;
    const generate = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error("api error"));
      return Promise.resolve(JSON.stringify([{ speaker: "haru", text: "ok" }]));
    });

    const saved = await runAiMessageBatch({ ...deps, generate });
    // z1 は失敗・z2 は成功（1 件）。リトライしないので generate は 2 回だけ
    expect(generate).toHaveBeenCalledTimes(2);
    expect(saved).toHaveLength(1);
    expect(await deps.messageRepo.listByChannel("z1")).toHaveLength(0);
    expect(await deps.messageRepo.listByChannel("z2")).toHaveLength(1);
  });

  it("成功時は BatchRunLog に status:success と件数を記録する", async () => {
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan" }]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    await deps.membershipRepo.addMember("zatsudan", "ken");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    await runAiMessageBatch({ ...deps, generate });
    const logs = await deps.batchRunLogRepository.findRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
    expect(logs[0]?.messageCount).toBe(2);
  });

  it("チャンネル生成が失敗したら BatchRunLog に status:failure を記録する", async () => {
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan" }]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    const generate = vi.fn().mockRejectedValue(new Error("api error"));

    await runAiMessageBatch({ ...deps, generate });
    const logs = await deps.batchRunLogRepository.findRecent(10);
    expect(logs[0]?.status).toBe("failure");
    expect(logs[0]?.messageCount).toBe(0);
    expect(logs[0]?.errorMessage).toContain("zatsudan");
  });

  it("bot 所属がいないチャンネルは生成しない", async () => {
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan" }]);
    await deps.membershipRepo.addMember("zatsudan", "user1"); // 非 bot のみ
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(generate).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });
});
