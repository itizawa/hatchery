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
  { createdEmployeeId: "haru", text: "やあ" },
  { createdEmployeeId: "ken", text: "よろしく" },
  { createdEmployeeId: "user1", text: "（人間は喘らないはず）" },
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

  it("goal.type='chat' のチャンネルのみ対象にし、isBot の発言だけを保存する", async () => {
    const deps = buildDeps([
      { id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } },
      { id: "shigoto", label: "仕事", type: "task", goal: { type: "chat" } },
      { id: "kikaku", label: "企画", type: "planning", goal: { type: "issue" } },
    ]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    await deps.membershipRepo.addMember("zatsudan", "ken");
    await deps.membershipRepo.addMember("zatsudan", "user1");
    // goal=issue のチャンネルにも所属者を置くが、対象外なので生成されない
    await deps.membershipRepo.addMember("kikaku", "haru");

    const generate = vi.fn().mockResolvedValue(conversationJson);
    const saved = await runAiMessageBatch({ ...deps, generate });

    // 生成は goal=chat の zatsudan の 1 回だけ（shigoto は goal=chat だがメンバーなし）
    expect(generate).toHaveBeenCalledTimes(1);
    // user1（非 bot）は除外され 2 件だけ保存
    expect(saved).toHaveLength(2);
    expect(saved.map((m) => m.createdEmployeeId)).toEqual(["haru", "ken"]);
    // バッチ生成メッセージは postedAt が未来時刻（#183: 予約表示）
    const now = Date.now();
    expect(saved[0].postedAt.getTime()).toBeGreaterThan(now);
    // goal=issue の kikaku には何も保存されない
    expect(await deps.messageRepo.listByChannel("kikaku")).toHaveLength(0);
  });

  it("API キーが未設定なら何も生成せず空配列を返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } }]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(saved).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("あるチャンネルの生成が失敗してもリトライせず次チャンネルを継続する", async () => {
    const deps = buildDeps([
      { id: "z1", label: "雑談１", type: "zatsudan", goal: { type: "chat" } },
      { id: "z2", label: "雑談２", type: "zatsudan", goal: { type: "chat" } },
    ]);
    await deps.membershipRepo.addMember("z1", "haru");
    await deps.membershipRepo.addMember("z2", "haru");

    let call = 0;
    const generate = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.reject(new Error("api error"));
      return Promise.resolve(JSON.stringify([{ createdEmployeeId: "haru", text: "ok" }]));
    });

    const saved = await runAiMessageBatch({ ...deps, generate });
    // z1 は失敗・z2 は成功（1 件）。リトライしないので generate は 2 回だけ
    expect(generate).toHaveBeenCalledTimes(2);
    expect(saved).toHaveLength(1);
    expect(await deps.messageRepo.listByChannel("z1")).toHaveLength(0);
    // z2 の生成済みメッセージは未来 postedAt なので listByChannel では見えない
    const z2Recent = await deps.messageRepo.listRecentByChannel("z2", 10);
    expect(z2Recent).toHaveLength(1);
  });

  it("成功時は BatchRunLog に status:success と件数を記録する", async () => {
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } }]);
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
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } }]);
    await deps.membershipRepo.addMember("zatsudan", "haru");
    const generate = vi.fn().mockRejectedValue(new Error("api error"));

    await runAiMessageBatch({ ...deps, generate });
    const logs = await deps.batchRunLogRepository.findRecent(10);
    expect(logs[0]?.status).toBe("failure");
    expect(logs[0]?.messageCount).toBe(0);
    expect(logs[0]?.errorMessage).toContain("zatsudan");
  });

  it("bot 所属がいないチャンネルは生成しない", async () => {
    const deps = buildDeps([{ id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } }]);
    await deps.membershipRepo.addMember("zatsudan", "user1"); // 非 bot のみ
    const generate = vi.fn().mockResolvedValue(conversationJson);

    const saved = await runAiMessageBatch({ ...deps, generate });
    expect(generate).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });
});
