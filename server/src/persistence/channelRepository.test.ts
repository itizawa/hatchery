import { describe, expect, it } from "vitest";

import { InMemoryChannelRepository } from "./channelRepository.js";

describe("InMemoryChannelRepository: summary (#53)", () => {
  it("初期状態の getSummary は summary / summaryUpdatedAt とも null を返す", async () => {
    const repo = new InMemoryChannelRepository();
    const s = await repo.getSummary("zatsudan");
    expect(s).toEqual({ summary: null, summaryUpdatedAt: null });
  });

  it("存在しないチャンネルの getSummary は null を返す", async () => {
    const repo = new InMemoryChannelRepository();
    expect(await repo.getSummary("unknown")).toBeNull();
  });

  it("updateSummary で summary を保存し getSummary で取得できる", async () => {
    const repo = new InMemoryChannelRepository();
    await repo.updateSummary("zatsudan", "これまでのあらすじ");
    const s = await repo.getSummary("zatsudan");
    expect(s?.summary).toBe("これまでのあらすじ");
    expect(s?.summaryUpdatedAt).toBeInstanceOf(Date);
  });

  it("updateSummary は上書きする", async () => {
    const repo = new InMemoryChannelRepository();
    await repo.updateSummary("zatsudan", "古い");
    await repo.updateSummary("zatsudan", "新しい");
    expect((await repo.getSummary("zatsudan"))?.summary).toBe("新しい");
  });
});
