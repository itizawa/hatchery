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

  it("23時間59分は『23時間前』（24時間未満の境界）", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-13T12:01:00Z"), now })).toBe("23時間前");
  });

  it("ちょうど24時間は『1日前』", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-13T12:00:00Z"), now })).toBe("1日前");
  });

  it("24時間以上7日未満は『N日前』（端数切り捨て）", () => {
    // 24時間1秒 → 1日前
    expect(formatRelativeTime({ target: new Date("2026-06-13T11:59:59Z"), now })).toBe("1日前");
    // ちょうど6日 → 6日前
    expect(formatRelativeTime({ target: new Date("2026-06-08T12:00:00Z"), now })).toBe("6日前");
    // 6日23時間59分59秒 → 6日前
    expect(formatRelativeTime({ target: new Date("2026-06-07T12:00:01Z"), now })).toBe("6日前");
  });

  it("ちょうど7日は絶対日付『YYYY/M/D』を返す", () => {
    expect(formatRelativeTime({ target: new Date("2026-06-07T12:00:00Z"), now })).toBe("2026/6/7");
  });

  it("7日以上は絶対日付『YYYY/M/D』を返す", () => {
    // 7日と1秒
    expect(formatRelativeTime({ target: new Date("2026-06-07T11:59:59Z"), now })).toBe("2026/6/7");
    expect(formatRelativeTime({ target: new Date("2025-12-25T03:00:00Z"), now })).toBe("2025/12/25");
  });

  it("不正な Date（NaN）は空文字を返す", () => {
    expect(formatRelativeTime({ target: new Date("invalid"), now })).toBe("");
    expect(formatRelativeTime({ target: new Date("2026-06-14T11:00:00Z"), now: new Date("invalid") })).toBe("");
  });

  it("DST（夏時間）の切り替え跨ぎでも UTC 差分ベースで『N日前』を判定する（#1043）", () => {
    // 2026-11-01 は America/New_York の DST 終了日（02:00 EDT → 01:00 EST、25時間ある日）。
    // target/now とも同じローカル暦日（Nov 1）に収まるため、ローカル暦日差ベースの判定だと
    // 「0日前」になってしまうが、UTC ミリ秒差はちょうど 24 時間（DAY_MS）あるため「1日前」が正しい。
    const originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const dstTarget = new Date("2026-11-01T04:30:00Z");
      const dstNow = new Date("2026-11-02T04:30:00Z");
      expect(formatRelativeTime({ target: dstTarget, now: dstNow })).toBe("1日前");
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});
