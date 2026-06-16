import { describe, expect, it } from "vitest";

import { generateSlotKey } from "./generateSlotKey.js";

describe("generateSlotKey", () => {
  it("UTC 基準の 'YYYY-MM-DDTHH:MM' 形式を返す", () => {
    const date = new Date("2026-06-15T09:00:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-06-15T09:00");
  });

  it("分の値をゼロ埋めする", () => {
    const date = new Date("2026-06-15T09:05:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-06-15T09:05");
  });

  it("時の値をゼロ埋めする", () => {
    const date = new Date("2026-06-15T03:30:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-06-15T03:30");
  });

  it("月の値をゼロ埋めする", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-01-01T00:00");
  });

  it("日の値をゼロ埋めする", () => {
    const date = new Date("2026-06-05T12:00:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-06-05T12:00");
  });

  it("ローカル時刻ではなく UTC 基準で生成する", () => {
    // UTC 23:59 はどのタイムゾーンでも同じ UTC 時刻を参照する。
    const date = new Date("2026-06-15T23:59:00.000Z");
    expect(generateSlotKey(date)).toBe("2026-06-15T23:59");
  });

  it("秒・ミリ秒は無視される（分の切り捨てのみ）", () => {
    const date = new Date("2026-06-15T12:34:56.789Z");
    expect(generateSlotKey(date)).toBe("2026-06-15T12:34");
  });

  it("引数を省略すると現在時刻から生成される（形式チェックのみ）", () => {
    const result = generateSlotKey();
    // "YYYY-MM-DDTHH:MM" 形式にマッチすること。
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
