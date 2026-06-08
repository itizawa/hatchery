import { describe, expect, it } from "vitest";
import { TokenUsageLogSchema } from "./tokenUsageLog.js";

describe("TokenUsageLogSchema", () => {
  const validLog = {
    id: "log-1",
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    model: "claude-haiku-4-5",
    inputTokens: 100,
    outputTokens: 50,
    batchRunLogId: null,
  };

  it("有効なデータをパースできる", () => {
    const result = TokenUsageLogSchema.parse(validLog);
    expect(result.id).toBe("log-1");
    expect(result.model).toBe("claude-haiku-4-5");
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.batchRunLogId).toBeNull();
  });

  it("batchRunLogId がある場合もパースできる", () => {
    const result = TokenUsageLogSchema.parse({ ...validLog, batchRunLogId: "batch-1" });
    expect(result.batchRunLogId).toBe("batch-1");
  });

  it("occurredAt を文字列から Date に変換する", () => {
    const result = TokenUsageLogSchema.parse({ ...validLog, occurredAt: "2026-01-01T00:00:00Z" });
    expect(result.occurredAt).toBeInstanceOf(Date);
  });

  it("inputTokens が負の場合はエラー", () => {
    expect(() => TokenUsageLogSchema.parse({ ...validLog, inputTokens: -1 })).toThrow();
  });

  it("outputTokens が負の場合はエラー", () => {
    expect(() => TokenUsageLogSchema.parse({ ...validLog, outputTokens: -1 })).toThrow();
  });

  it("model が空文字の場合はエラー", () => {
    expect(() => TokenUsageLogSchema.parse({ ...validLog, model: "" })).toThrow();
  });

  it("model が 100 文字を超える場合はエラー", () => {
    expect(() => TokenUsageLogSchema.parse({ ...validLog, model: "a".repeat(101) })).toThrow();
  });

  it("model が 100 文字の場合は OK", () => {
    const result = TokenUsageLogSchema.parse({ ...validLog, model: "a".repeat(100) });
    expect(result.model).toHaveLength(100);
  });
});
