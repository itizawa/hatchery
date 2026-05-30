import { describe, expect, it } from "vitest";

import { InMemorySceneRepository } from "../persistence/sceneRepository.js";

import { runSceneBatch, stubSceneGenerator } from "./runSceneBatch.js";

describe("runSceneBatch (AC-5) — Express 非依存の定時バッチ", () => {
  it("スタブ生成器でシーンを生成し保存して結果を返す", async () => {
    const repo = new InMemorySceneRepository();
    const record = await runSceneBatch({ sceneRepository: repo });
    expect(record.id).toBeTruthy();
    expect(record.messages.length).toBeGreaterThan(0);
    expect(await repo.list()).toHaveLength(1);
  });

  it("カスタム生成器を注入できる", async () => {
    const repo = new InMemorySceneRepository();
    const record = await runSceneBatch({
      sceneRepository: repo,
      generate: () => ({
        scene: "custom",
        messages: [{ speaker: "e1", channel: "zatsudan", text: "x" }],
      }),
    });
    expect(record.scene).toBe("custom");
  });

  it("stubSceneGenerator は messages を 1 件以上もつ妥当な Scene を返す", () => {
    const scene = stubSceneGenerator();
    expect(scene.scene.length).toBeGreaterThan(0);
    expect(scene.messages.length).toBeGreaterThan(0);
  });
});
