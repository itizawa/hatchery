import { describe, expect, it } from "vitest";

import { isShallowDirty } from "./formDirty.js";

describe("isShallowDirty", () => {
  it("全フィールドが同一ならfalseを返す", () => {
    expect(isShallowDirty({ name: "Alice" }, { name: "Alice" })).toBe(false);
  });

  it("1フィールドが異なればtrueを返す", () => {
    expect(isShallowDirty({ name: "Alice" }, { name: "Bob" })).toBe(true);
  });

  it("複数フィールドが全て同一ならfalseを返す", () => {
    expect(isShallowDirty({ displayName: "Alice", avatarUrl: "" }, { displayName: "Alice", avatarUrl: "" })).toBe(false);
  });

  it("一部のフィールドだけ異なればtrueを返す", () => {
    expect(isShallowDirty({ displayName: "Alice", avatarUrl: "" }, { displayName: "Alice", avatarUrl: "https://example.com/a.png" })).toBe(true);
  });
});
