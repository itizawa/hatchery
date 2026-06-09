import { describe, expect, it } from "vitest";

import { InMemoryMessageRepository } from "./messageRepository.js";

describe("InMemoryMessageRepository", () => {
  it("createMany で id を採番し list で挿入順に返す", async () => {
    const repo = new InMemoryMessageRepository();
    await repo.createMany([
      { createdEmployeeId:"e1", channel: "zatsudan", text: "1" },
      { createdEmployeeId:"e2", channel: "shigoto", text: "2" },
    ]);
    await repo.createMany([{ createdEmployeeId:"e3", channel: "zatsudan", text: "3" }]);

    const all = await repo.list();
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.text)).toEqual(["1", "2", "3"]);
    expect(new Set(all.map((m) => m.id)).size).toBe(3);
  });

  it("createMany が返す record は createdEmployeeId / channel / text / createdAt / order を持つ", async () => {
    const repo = new InMemoryMessageRepository();
    const [first, second] = await repo.createMany([
      { createdEmployeeId: "e1", channel: "zatsudan", text: "hi" },
      { createdEmployeeId: "e2", channel: "shigoto", text: "bye" },
    ]);
    expect(first?.createdEmployeeId).toBe("e1");
    expect(first?.channel).toBe("zatsudan");
    expect(first?.text).toBe("hi");
    expect(first?.createdAt).toBeInstanceOf(Date);
    expect(first?.order).toBe(0);
    expect(second?.order).toBe(1);
  });

  it("list は内部配列の防御的コピーを返す", async () => {
    const repo = new InMemoryMessageRepository();
    const first = await repo.list();
    first.push({
      id: "x",
      createdEmployeeId: "e1",
      channel: "zatsudan",
      text: "injected",
      createdAt: new Date(0),
      order: 0,
    });
    expect(await repo.list()).toHaveLength(0);
  });

  describe("listRecentByChannel (#53)", () => {
    it("指定チャンネルの直近 limit 件を新しい順（order 降順）で返す", async () => {
      const repo = new InMemoryMessageRepository();
      await repo.createMany([
        { createdEmployeeId:"a", channel: "zatsudan", text: "1" },
        { createdEmployeeId:"a", channel: "zatsudan", text: "2" },
        { createdEmployeeId:"a", channel: "zatsudan", text: "3" },
        { createdEmployeeId:"a", channel: "shigoto", text: "x" },
      ]);
      const recent = await repo.listRecentByChannel("zatsudan", 2);
      expect(recent.map((m) => m.text)).toEqual(["3", "2"]);
    });

    it("limit が件数より大きければ全件を返す", async () => {
      const repo = new InMemoryMessageRepository();
      await repo.createMany([
        { createdEmployeeId:"a", channel: "zatsudan", text: "1" },
        { createdEmployeeId:"a", channel: "zatsudan", text: "2" },
      ]);
      expect(await repo.listRecentByChannel("zatsudan", 30)).toHaveLength(2);
    });

    it("該当チャンネルが無ければ空配列を返す", async () => {
      const repo = new InMemoryMessageRepository();
      expect(await repo.listRecentByChannel("none", 30)).toEqual([]);
    });
  });

  describe("listByChannelSince (#53)", () => {
    it("since 以降（createdAt >= since）のメッセージのみ返す", async () => {
      const repo = new InMemoryMessageRepository();
      // InMemory の createMany は createdAt を epoch(0) で採番する。
      await repo.createMany([{ createdEmployeeId:"a", channel: "zatsudan", text: "1" }]);
      expect(await repo.listByChannelSince("zatsudan", new Date(0))).toHaveLength(1);
      expect(await repo.listByChannelSince("zatsudan", new Date(1))).toHaveLength(0);
    });

    it("別チャンネルは含めない", async () => {
      const repo = new InMemoryMessageRepository();
      await repo.createMany([
        { createdEmployeeId:"a", channel: "zatsudan", text: "1" },
        { createdEmployeeId:"a", channel: "shigoto", text: "2" },
      ]);
      const res = await repo.listByChannelSince("zatsudan", new Date(0));
      expect(res.map((m) => m.channel)).toEqual(["zatsudan"]);
    });
  });
});
