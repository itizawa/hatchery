import { describe, expect, it } from "vitest";

import { BatchRunLogSchema, BatchRunLogStatusSchema } from "./batchRunLog.js";

describe("BatchRunLogStatusSchema", () => {
  it("success / failure を受け入れる", () => {
    expect(BatchRunLogStatusSchema.parse("success")).toBe("success");
    expect(BatchRunLogStatusSchema.parse("failure")).toBe("failure");
  });

  it("不正値はエラーになる", () => {
    expect(() => BatchRunLogStatusSchema.parse("pending")).toThrow();
  });
});

describe("BatchRunLogSchema", () => {
  it("正常なオブジェクトを検証できる", () => {
    const now = new Date();
    const result = BatchRunLogSchema.parse({
      id: "abc123",
      executedAt: now.toISOString(),
      status: "success",
      messageCount: 5,
      errorMessage: null,
      errorCode: null,
    });
    expect(result.id).toBe("abc123");
    expect(result.status).toBe("success");
    expect(result.messageCount).toBe(5);
    expect(result.errorMessage).toBeNull();
  });

  it("failure ステータスのエラー情報を持つオブジェクトを検証できる", () => {
    const result = BatchRunLogSchema.parse({
      id: "err1",
      executedAt: new Date().toISOString(),
      status: "failure",
      messageCount: 0,
      errorMessage: "API key not set",
      errorCode: "MISSING_API_KEY",
    });
    expect(result.status).toBe("failure");
    expect(result.errorMessage).toBe("API key not set");
    expect(result.errorCode).toBe("MISSING_API_KEY");
  });

  it("必須フィールドが欠けているとエラーになる", () => {
    expect(() => BatchRunLogSchema.parse({ id: "x", status: "success" })).toThrow();
  });
});
