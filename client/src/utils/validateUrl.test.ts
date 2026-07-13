import { describe, expect, it } from "vitest";

import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
  it("空文字を渡すと undefined（valid 扱い）を返す", () => {
    expect(validateUrl("")).toBeUndefined();
  });

  it("有効な URL を渡すと undefined を返す", () => {
    expect(validateUrl("https://example.com")).toBeUndefined();
  });

  it("無効な URL を渡すとエラーメッセージ文字列を返す", () => {
    expect(validateUrl("not a url")).toBe("有効な URL を入力してください");
  });
});
