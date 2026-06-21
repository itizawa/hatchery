import { describe, expect, it } from "vitest";

import { formatAbsoluteTime } from "./formatAbsoluteTime.js";

describe("formatAbsoluteTime", () => {
  it("UTC 基準で『YYYY/M/D HH:MM:SS』形式を返す", () => {
    expect(formatAbsoluteTime({ target: new Date("2026-06-14T12:00:00Z") })).toBe(
      "2026/6/14 12:00:00",
    );
  });

  it("月・日・時が 1 桁のときゼロパディングしない（分・秒は 1 桁でも 2 桁ゼロパディングする）", () => {
    expect(formatAbsoluteTime({ target: new Date("2026-01-05T03:04:05Z") })).toBe(
      "2026/1/5 3:04:05",
    );
  });

  it("分・秒が 2 桁のときゼロパディングする", () => {
    expect(formatAbsoluteTime({ target: new Date("2025-12-25T23:59:59Z") })).toBe(
      "2025/12/25 23:59:59",
    );
  });

  it("不正な Date（NaN）は空文字を返す", () => {
    expect(formatAbsoluteTime({ target: new Date("invalid") })).toBe("");
  });
});
