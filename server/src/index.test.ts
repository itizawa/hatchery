import { describe, expect, it } from "vitest";

import { createApp, createInMemoryUserRepository } from "./index.js";

describe("@hatchery/server パッケージエントリ", () => {
  it("createApp / createInMemoryUserRepository を公開する", () => {
    expect(typeof createApp).toBe("function");
    expect(typeof createInMemoryUserRepository).toBe("function");
  });
});
