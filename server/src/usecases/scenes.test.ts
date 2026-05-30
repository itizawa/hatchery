import { describe, expect, it } from "vitest";

import { InMemorySceneRepository } from "../persistence/sceneRepository.js";

import { createScene } from "./createScene.js";
import { listScenes } from "./listScenes.js";

describe("usecases (AC-4) — DB 非依存（InMemory リポジトリ注入）", () => {
  it("createScene で保存し、listScenes で取得できる", async () => {
    const repo = new InMemorySceneRepository();
    const created = await createScene(repo, {
      scene: "テスト",
      messages: [{ speaker: "e1", channel: "zatsudan", text: "hi" }],
    });
    expect(created.id).toBeTruthy();

    const all = await listScenes(repo);
    expect(all).toHaveLength(1);
    expect(all[0]?.scene).toBe("テスト");
  });
});
