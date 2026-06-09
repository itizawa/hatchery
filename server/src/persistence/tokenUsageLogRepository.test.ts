import { describe, expect, it } from "vitest";
import { InMemoryTokenUsageLogRepository } from "./tokenUsageLogRepository.js";

describe("InMemoryTokenUsageLogRepository", () => {
  it("create でレコードを追加し id と occurredAt が付与される", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    const log = await repo.create({
      model: "claude-haiku-4-5",
      inputTokens: 100,
      outputTokens: 50,
      batchRunLogId: null,
    });
    expect(log.id).toBeDefined();
    expect(log.occurredAt).toBeInstanceOf(Date);
    expect(log.model).toBe("claude-haiku-4-5");
    expect(log.inputTokens).toBe(100);
    expect(log.outputTokens).toBe(50);
    expect(log.batchRunLogId).toBeNull();
  });

  it("batchRunLogId あり/なし両方保存できる", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    const log1 = await repo.create({ model: "m", inputTokens: 10, outputTokens: 5, batchRunLogId: "batch-1" });
    const log2 = await repo.create({ model: "m", inputTokens: 20, outputTokens: 10, batchRunLogId: null });
    expect(log1.batchRunLogId).toBe("batch-1");
    expect(log2.batchRunLogId).toBeNull();
  });

  it("findRecent は occurredAt 降順で最大 limit 件取得する", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    await repo.create({ model: "m", inputTokens: 1, outputTokens: 1, batchRunLogId: null });
    await repo.create({ model: "m", inputTokens: 2, outputTokens: 2, batchRunLogId: null });
    await repo.create({ model: "m", inputTokens: 3, outputTokens: 3, batchRunLogId: null });
    const logs = await repo.findRecent(2);
    expect(logs).toHaveLength(2);
    // 最新（inputTokens=3）が先頭
    expect(logs[0].inputTokens).toBe(3);
    expect(logs[1].inputTokens).toBe(2);
  });

  it("findRecent に空リストを返す（ログ未登録時）", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    const logs = await repo.findRecent(10);
    expect(logs).toEqual([]);
  });

  it("summarize はすべてのトークン合計を返す", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    await repo.create({ model: "m", inputTokens: 100, outputTokens: 50, batchRunLogId: null });
    await repo.create({ model: "m", inputTokens: 200, outputTokens: 100, batchRunLogId: null });
    const summary = await repo.summarize();
    expect(summary.totalInputTokens).toBe(300);
    expect(summary.totalOutputTokens).toBe(150);
    expect(summary.totalTokens).toBe(450);
  });

  it("summarize はログなしの場合 0 を返す", async () => {
    const repo = new InMemoryTokenUsageLogRepository();
    const summary = await repo.summarize();
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });
});
