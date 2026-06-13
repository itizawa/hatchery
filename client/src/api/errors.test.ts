import { describe, expect, it } from "vitest";

import { buildApiErrorMessage, getApiErrorMessage } from "./errors.js";

describe("getApiErrorMessage（#476）", () => {
  it("Error インスタンスは message を返す", () => {
    expect(getApiErrorMessage(new Error("権限がありません"))).toBe("権限がありません");
  });

  it("message が空の Error は fallback を返す", () => {
    expect(getApiErrorMessage(new Error(""))).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
  });

  it("openapi-fetch の { error: string } 形オブジェクトは error 文字列を返す", () => {
    expect(getApiErrorMessage({ error: "InternalServerError" })).toBe("InternalServerError");
  });

  it("{ error: '' }（空文字）は fallback を返す", () => {
    expect(getApiErrorMessage({ error: "" })).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
  });

  it("null / undefined / 不明形は fallback を返す", () => {
    expect(getApiErrorMessage(null)).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
    expect(getApiErrorMessage(undefined)).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
    expect(getApiErrorMessage({ foo: "bar" })).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
    expect(getApiErrorMessage("just a string")).toBe(
      "保存に失敗しました。時間をおいて再度お試しください。",
    );
  });

  it("fallback 文言を指定できる", () => {
    expect(getApiErrorMessage(null, "更新に失敗しました")).toBe("更新に失敗しました");
  });
});

describe("buildApiErrorMessage（#476）", () => {
  it("{ error: string } があればその文字列を返す", () => {
    expect(buildApiErrorMessage({ error: "Forbidden" }, 403, "PATCH 失敗")).toBe("Forbidden");
  });

  it("error が無ければ fallback にステータスを付して返す", () => {
    expect(buildApiErrorMessage(undefined, 500, "PATCH 失敗")).toBe("PATCH 失敗 (500)");
  });

  it("error が空文字なら fallback にステータスを付して返す", () => {
    expect(buildApiErrorMessage({ error: "" }, 400, "PATCH 失敗")).toBe("PATCH 失敗 (400)");
  });
});
