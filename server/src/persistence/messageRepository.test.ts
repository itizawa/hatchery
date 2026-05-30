import { describe, expect, it } from "vitest";

import { InMemoryMessageRepository } from "./messageRepository.js";

describe("InMemoryMessageRepository", () => {
  it("createMany で id を採番し list で挿入順に返す", async () => {
    const repo = new InMemoryMessageRepository();
    await repo.createMany([
      { speaker: "e1", channel: "zatsudan", text: "1" },
      { speaker: "e2", channel: "shigoto", text: "2" },
    ]);
    await repo.createMany([{ speaker: "e3", channel: "zatsudan", text: "3" }]);

    const all = await repo.list();
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.text)).toEqual(["1", "2", "3"]);
    expect(new Set(all.map((m) => m.id)).size).toBe(3);
  });

  it("createMany が返す record は speaker / channel / text / createdAt / order を持つ", async () => {
    const repo = new InMemoryMessageRepository();
    const [first, second] = await repo.createMany([
      { speaker: "e1", channel: "zatsudan", text: "hi" },
      { speaker: "e2", channel: "shigoto", text: "bye" },
    ]);
    expect(first?.speaker).toBe("e1");
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
      speaker: "e1",
      channel: "zatsudan",
      text: "injected",
      createdAt: new Date(0),
      order: 0,
    });
    expect(await repo.list()).toHaveLength(0);
  });
});
