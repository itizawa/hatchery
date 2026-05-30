import { describe, expect, it } from "vitest";

import { createApp, InMemorySceneRepository, runSceneBatch } from "./index.js";

describe("@hatchery/server パッケージエントリ", () => {
  it("createApp / runSceneBatch / InMemorySceneRepository を公開する", () => {
    expect(typeof createApp).toBe("function");
    expect(typeof runSceneBatch).toBe("function");
    expect(typeof InMemorySceneRepository).toBe("function");
  });
});
