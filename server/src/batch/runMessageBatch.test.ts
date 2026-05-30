import { describe, expect, it } from "vitest";

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
