import { describe, expect, it } from "vitest";

import { createApp, InMemoryUserRepository } from "./index.js";

describe("@hatchery/server パッケージエントリ", () => {
  it("createApp / InMemoryUserRepository を公開する", () => {
    expect(typeof createApp).toBe("function");
    expect(typeof InMemoryUserRepository).toBe("function");
  });
});
