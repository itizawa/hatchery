import { describe, expect, it } from "vitest";

import { createApp, InMemoryMessageRepository, runMessageBatch } from "./index.js";

describe("@hatchery/server パッケージエントリ", () => {
  it("createApp / runMessageBatch / InMemoryMessageRepository を公開する", () => {
    expect(typeof createApp).toBe("function");
    expect(typeof runMessageBatch).toBe("function");
    expect(typeof InMemoryMessageRepository).toBe("function");
  });
});
