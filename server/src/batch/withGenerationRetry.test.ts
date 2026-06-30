import { describe, expect, it, vi } from "vitest";

import { withGenerationRetry, RetryableGenerationError } from "./withGenerationRetry.js";

describe("withGenerationRetry (#626)", () => {
  it("最初の試行で成功した場合はリトライしない", async () => {
    const fn = vi.fn().mockResolvedValueOnce("success");
    const result = await withGenerationRetry({ fn, maxRetries: 2, label: "test" });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("1 回目が RetryableGenerationError で 2 回目に成功した場合、合計 2 回試行する", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableGenerationError("JSON パース失敗"))
      .mockResolvedValueOnce("success");
    const result = await withGenerationRetry({ fn, maxRetries: 2, label: "test" });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("2 回目が RetryableGenerationError で 3 回目に成功した場合、合計 3 回試行する", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableGenerationError("JSON パース失敗"))
      .mockRejectedValueOnce(new RetryableGenerationError("スキーマ検証失敗"))
      .mockResolvedValueOnce("success");
    const result = await withGenerationRetry({ fn, maxRetries: 2, label: "test" });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("maxRetries 回を超えて失敗し続けた場合、最後のエラーを throw する", async () => {
    const lastError = new RetryableGenerationError("author 検証失敗");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableGenerationError("JSON パース失敗"))
      .mockRejectedValueOnce(new RetryableGenerationError("スキーマ検証失敗"))
      .mockRejectedValueOnce(lastError);
    await expect(withGenerationRetry({ fn, maxRetries: 2, label: "test" })).rejects.toThrow(lastError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("非リトライエラー（通常の Error）は即 throw し、リトライしない", async () => {
    const nonRetryable = new Error("ワーカー未設定");
    const fn = vi.fn().mockRejectedValueOnce(nonRetryable);
    await expect(withGenerationRetry({ fn, maxRetries: 2, label: "test" })).rejects.toThrow(nonRetryable);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("maxRetries が 0 の場合、失敗したら即 throw する", async () => {
    const err = new RetryableGenerationError("パース失敗");
    const fn = vi.fn().mockRejectedValueOnce(err);
    await expect(withGenerationRetry({ fn, maxRetries: 0, label: "test" })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("maxRetries が負の場合、fn を呼ばずに Error を throw する", async () => {
    const fn = vi.fn();
    await expect(withGenerationRetry({ fn, maxRetries: -1, label: "test" })).rejects.toThrow(
      "withGenerationRetry: test exhausted without error",
    );
    expect(fn).toHaveBeenCalledTimes(0);
  });
});
