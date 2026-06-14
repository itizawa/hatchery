import { afterEach, describe, expect, it, vi } from "vitest";

import { extractErrorMessage, logBatchError, logBatchInfo } from "./logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/** spy が受け取った 1 引数（1 行 JSON）をパースして返す。 */
function parseLastCall(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls;
  expect(calls.length).toBe(1);
  const arg = calls[0]?.[0];
  expect(typeof arg).toBe("string");
  return JSON.parse(arg as string) as Record<string, unknown>;
}

describe("logBatchInfo — info レベルの構造化ログ", () => {
  it("level:info と event を 1 行 JSON で console.log に出す", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logBatchInfo("community_batch.completed");
    expect(parseLastCall(spy)).toEqual({
      level: "info",
      event: "community_batch.completed",
    });
  });

  it("fields をマージして出力する", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logBatchInfo("community_batch.completed", { posts: 3, comments: 5 });
    expect(parseLastCall(spy)).toEqual({
      level: "info",
      event: "community_batch.completed",
      posts: 3,
      comments: 5,
    });
  });

  it("console.error には出力しない", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchInfo("x.y");
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe("logBatchError — error レベルの構造化ログ", () => {
  it("Error のとき message を error フィールドに入れて console.error に出す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchError("scheduled_run.failed", new Error("boom"));
    expect(parseLastCall(spy)).toEqual({
      level: "error",
      event: "scheduled_run.failed",
      error: "boom",
    });
  });

  it("非 Error（文字列）のとき String(err) を error に入れる", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchError("x.y", "plain string");
    expect(parseLastCall(spy)).toEqual({
      level: "error",
      event: "x.y",
      error: "plain string",
    });
  });

  it("非 Error（オブジェクト）のとき String(err) を error に入れる", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchError("x.y", { code: 1 });
    const parsed = parseLastCall(spy);
    expect(parsed.error).toBe(String({ code: 1 }));
  });

  it("fields をマージして出力する", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchError("community_batch.community_failed", new Error("oops"), {
      communityId: "c1",
    });
    expect(parseLastCall(spy)).toEqual({
      level: "error",
      event: "community_batch.community_failed",
      error: "oops",
      communityId: "c1",
    });
  });

  it("console.log には出力しない", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    logBatchError("x.y", new Error("z"));
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("extractErrorMessage — Error/非Error の分岐を集約", () => {
  it("Error なら message を返す", () => {
    expect(extractErrorMessage(new Error("hello"))).toBe("hello");
  });

  it("非 Error なら String(err) を返す", () => {
    expect(extractErrorMessage("str")).toBe("str");
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(null)).toBe("null");
  });
});
