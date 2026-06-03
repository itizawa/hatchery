import { describe, expect, it } from "vitest";
import preview from "../.storybook/preview.js";

// preview.tsx のスモークテスト: モジュールとして正常にインポートでき、
// decorators 配列が定義されていることを確認する
describe("storybook preview", () => {
  it("decorators 配列が定義されている", () => {
    expect(preview).toBeDefined();
    expect(preview.decorators!.length).toBeGreaterThan(0);
  });
});
