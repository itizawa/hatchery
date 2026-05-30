import { describe, expect, it } from "vitest";

import { InMemorySceneRepository } from "./sceneRepository.js";

describe("InMemorySceneRepository", () => {
  it("create で id を採番し list で挿入順に返す", async () => {
    const repo = new InMemorySceneRepository();
    await repo.create({
      scene: "a",
      messages: [{ speaker: "e1", channel: "zatsudan", text: "1" }],
    });
    await repo.create({
      scene: "b",
      messages: [{ speaker: "e2", channel: "shigoto", text: "2" }],
    });

    const all = await repo.list();
    expect(all.map((s) => s.scene)).toEqual(["a", "b"]);
    expect(new Set(all.map((s) => s.id)).size).toBe(2);
  });

  it("list は内部配列の防御的コピーを返す", async () => {
    const repo = new InMemorySceneRepository();
    const first = await repo.list();
    first.push({ id: "x", scene: "z", createdAt: new Date(0), messages: [] });
    expect(await repo.list()).toHaveLength(0);
  });
});
