import { describe, expect, it } from "vitest";

// preview.tsx のスモークテスト: モジュールとして正常にインポートでき、
// decorators 配列が定義されていることを確認する
describe("storybook preview", () => {
  it("decorators 配列が定義されている", async () => {
    const mod = await import("../.storybook/preview.js");
    const preview = mod.default;
    expect(preview).toBeDefined();
    expect(Array.isArray(preview.decorators)).toBe(true);
    expect(preview.decorators!.length).toBeGreaterThan(0);
  });
});
