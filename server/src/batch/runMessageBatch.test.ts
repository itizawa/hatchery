import { describe, expect, it } from "vitest";

import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

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
});

describe("runMessageBatch — BatchRunLogRepository 連携", () => {
  it("成功時に status=success・messageCount のログを保存する", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const logRepo = new InMemoryBatchRunLogRepository();
    const records = await runMessageBatch({
      messageRepository: messageRepo,
      batchRunLogRepository: logRepo,
      generate: () => [
        { speaker: "e1", channel: "zatsudan", text: "hello" },
        { speaker: "e2", channel: "zatsudan", text: "world" },
      ],
    });
    const logs = await logRepo.listRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
    expect(logs[0]!.messageCount).toBe(records.length);
    expect(logs[0]!.errorMessage).toBeNull();
  });

  it("失敗時に status=failure・errorMessage のログを保存し、エラーを再スローする", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const logRepo = new InMemoryBatchRunLogRepository();

    await expect(
      runMessageBatch({
        messageRepository: messageRepo,
        batchRunLogRepository: logRepo,
        generate: () => {
          throw new Error("LLM timeout");
        },
      }),
    ).rejects.toThrow("LLM timeout");

    const logs = await logRepo.listRecent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("failure");
    expect(logs[0]!.errorMessage).toBe("LLM timeout");
    expect(logs[0]!.messageCount).toBeNull();
  });

  it("batchRunLogRepository が省略された場合もエラーなく動作する", async () => {
    const messageRepo = new InMemoryMessageRepository();
    const records = await runMessageBatch({ messageRepository: messageRepo });
    expect(records.length).toBeGreaterThan(0);
  });
});
