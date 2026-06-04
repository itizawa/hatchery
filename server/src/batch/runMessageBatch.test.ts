import { describe, expect, it } from "vitest";

import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";

import { runMessageBatch, stubMessageGenerator } from "./runMessageBatch.js";

describe("runMessageBatch — Express 非依存の定時バッチ", () => {
  it("スタブ生成器でメッセージを生成し保存して結果を返す", async () => {
    const repo = new InMemoryMessageRepository();
    const records = await runMessageBatch({ messageRepository: repo });
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]?.id).toBeTruthy();
    expect(await repo.list()).toHaveLength(records.length);
  });

  it("カスタム生成器を注入できる", async () => {
    const repo = new InMemoryMessageRepository();
    const records = await runMessageBatch({
      messageRepository: repo,
      generate: () => [
        { speaker: "e1", channel: "zatsudan", text: "custom" },
        { speaker: "e2", channel: "shigoto", text: "custom2" },
      ],
    });
    expect(records).toHaveLength(2);
    expect(records[0]?.text).toBe("custom");
  });

  it("stubMessageGenerator は 1 件以上の Message[] を返す", () => {
    const messages = stubMessageGenerator();
    expect(messages.length).toBeGreaterThan(0);
    messages.forEach((m) => {
      expect(typeof m.speaker).toBe("string");
      expect(typeof m.channel).toBe("string");
      expect(typeof m.text).toBe("string");
    });
  });

  it("成功時に BatchRunLogRepository に success ログを保存する", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const logRepo = new InMemoryBatchRunLogRepository();
    const records = await runMessageBatch({
      messageRepository: messageRepo,
      batchRunLogRepository: logRepo,
    });
    const logs = await logRepo.findRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("success");
    expect(logs[0]?.messageCount).toBe(records.length);
    expect(logs[0]?.errorMessage).toBeNull();
    expect(logs[0]?.errorCode).toBeNull();
  });

  it("失敗時に BatchRunLogRepository に failure ログを保存しエラーを再スローする", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const logRepo = new InMemoryBatchRunLogRepository();
    const error = new Error("generate failed");
    await expect(
      runMessageBatch({
        messageRepository: messageRepo,
        batchRunLogRepository: logRepo,
        generate: () => { throw error; },
      })
    ).rejects.toThrow("generate failed");
    const logs = await logRepo.findRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("failure");
    expect(logs[0]?.messageCount).toBe(0);
    expect(logs[0]?.errorMessage).toBe("generate failed");
  });

  it("batchRunLogRepository 未注入時はログ保存せず既存動作のまま", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const records = await runMessageBatch({ messageRepository: messageRepo });
    expect(records.length).toBeGreaterThan(0);
  });
});
