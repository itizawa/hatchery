import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./formatRelativeTime.js";

const now = new Date("2026-06-14T12:00:00Z");

describe("formatRelativeTime", () => {
  it("0秒（同時刻）は『たった今』", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T12:00:00Z"), now })).toBe("たった今");
  });

  it("999ms（1秒未満）は『たった今』", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:59:59.001Z"), now })).toBe("たった今");
  });

  it("未来（基準より後）の時刻も『たった今』にフォールバックして破綻しない", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T12:05:00Z"), now })).toBe("たった今");
  });

  it("1秒以上60秒未満は『N秒前』", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:59:59Z"), now })).toBe("1秒前");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:59:30Z"), now })).toBe("30秒前");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:59:01Z"), now })).toBe("59秒前");
  });

  it("60秒以上60分未満は『N分前』（端数切り捨て）", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:59:00Z"), now })).toBe("1分前");
    // 90秒 → 1分前（端数切り捨て）
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:58:30Z"), now })).toBe("1分前");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:01:30Z"), now })).toBe("58分前");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:01:00Z"), now })).toBe("59分前");
  });

  it("60分以上24時間未満は『N時間前』（端数切り捨て）", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:00:00Z"), now })).toBe("1時間前");
    // 1時間59分前 → 1時間前
    expect(formatRelativeTime({ target: new Date("2026-06-14T10:01:00Z"), now })).toBe("1時間前");
    expect(formatRelativeTime({ target: new Date("2026-06-13T13:00:00Z"), now })).toBe("23時間前");
  });

  it("24時間以上は絶対日付『YYYY/M/D』を返す", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-13T12:00:00Z"), now })).toBe("2026/6/13");
    expect(formatRelativeTime({ target: new Date("2026-06-08T12:00:00Z"), now })).toBe("2026/6/8");
    expect(formatRelativeTime({ target: new Date("2026-06-07T12:00:00Z"), now })).toBe("2026/6/7");
    expect(formatRelativeTime({ target: new Date("2025-12-25T03:00:00Z"), now })).toBe("2025/12/25");
  });

  it("不正な Date（NaN）は空文字を返す", () => {
    expect(formatRelativeTime({ target: new Date("invalid"), now })).toBe("");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:00:00Z"), now: new Date("invalid") })).toBe("");
  });
});
