import { afterEach, describe, expect, it, vi } from "vitest";

import { extractErrorInfo, logError, logInfo } from "./logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function parseLastCall(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls;
  expect(calls.length).toBe(1);
  const arg = calls[0]?.[0];
  expect(typeof arg).toBe("string");
  return JSON.parse(arg as string) as Record<string, unknown>;
}

describe("logInfo — info レベルの構造化ログ", () => {
  it("severity:INFO, level:info, event を 1 行 JSON で console.log に出す", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo({ event: "server.listening" });
    const parsed = parseLastCall(spy);
    expect(parsed).toEqual({
      severity: "INFO",
      level: "info",
      event: "server.listening",
    });
  });

  it("fields をマージして出力する", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo({ event: "server.listening", fields: { port: 3000 } });
    const parsed = parseLastCall(spy);
    expect(parsed).toEqual({
      severity: "INFO",
      level: "info",
      event: "server.listening",
      port: 3000,
    });
  });

  it("console.error には出力しない", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logInfo({ event: "server.listening" });
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("予約キー（level, severity, event）は fields で上書きされない", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logInfo({
      event: "server.listening",
      fields: { level: "warn", severity: "WARNING", event: "hacked" },
    });
    const parsed = parseLastCall(spy);
    expect(parsed.level).toBe("info");
    expect(parsed.severity).toBe("INFO");
    expect(parsed.event).toBe("server.listening");
  });
});

describe("logError — error レベルの構造化ログ（stack 保持）", () => {
  it("Error のとき error(message) + stack を JSON で console.error に出す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    logError({ event: "http.500", err });
    const parsed = parseLastCall(spy);
    expect(parsed.severity).toBe("ERROR");
    expect(parsed.level).toBe("error");
    expect(parsed.event).toBe("http.500");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(parsed.stack).toContain("Error: boom");
  });

  it("非 Error（文字列）のとき error: String(err) で stack を省略する", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError({ event: "http.500", err: "plain string" });
    const parsed = parseLastCall(spy);
    expect(parsed.error).toBe("plain string");
    expect(parsed).not.toHaveProperty("stack");
  });

  it("非 Error（オブジェクト）のとき String(err) を error に入れる", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError({ event: "http.500", err: { code: 1 } });
    const parsed = parseLastCall(spy);
    expect(parsed.error).toBe(String({ code: 1 }));
    expect(parsed).not.toHaveProperty("stack");
  });

  it("fields をマージして出力する", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError({
      event: "http.500",
      err: new Error("oops"),
      fields: { method: "GET", path: "/api/test" },
    });
    const parsed = parseLastCall(spy);
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/api/test");
    expect(parsed.event).toBe("http.500");
  });

  it("console.log には出力しない", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    logError({ event: "http.500", err: new Error("z") });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("予約キー（level, severity, event, error, stack）は fields で上書きされない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError({
      event: "http.500",
      err: new Error("real"),
      fields: {
        level: "warn",
        severity: "WARNING",
        event: "hacked",
        error: "fake",
        stack: "fake-stack",
      },
    });
    const parsed = parseLastCall(spy);
    expect(parsed.level).toBe("error");
    expect(parsed.severity).toBe("ERROR");
    expect(parsed.event).toBe("http.500");
    expect(parsed.error).toBe("real");
    expect(parsed.stack).toContain("Error: real");
  });
});

describe("extractErrorInfo — Error/非Error から message と stack を抽出", () => {
  it("Error なら message と stack を返す", () => {
    const err = new Error("hello");
    const info = extractErrorInfo(err);
    expect(info.message).toBe("hello");
    expect(typeof info.stack).toBe("string");
    expect(info.stack).toContain("Error: hello");
  });

  it("非 Error（文字列）なら message のみ返す（stack は undefined）", () => {
    const info = extractErrorInfo("str");
    expect(info.message).toBe("str");
    expect(info.stack).toBeUndefined();
  });

  it("非 Error（数値・null）なら String() で message を返す", () => {
    expect(extractErrorInfo(42).message).toBe("42");
    expect(extractErrorInfo(null).message).toBe("null");
  });
});
