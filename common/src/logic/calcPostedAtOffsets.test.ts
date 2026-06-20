import { describe, expect, it } from "vitest";

import { calcPostedAtOffsets } from "./calcPostedAtOffsets.js";

describe("calcPostedAtOffsets", () => {
  const base = new Date("2026-01-01T12:00:00.000Z");

  it("count=0 のとき空配列を返す", () => {
    expect(calcPostedAtOffsets({ baseTime: base, count: 0 })).toEqual([]);
  });

  it("count=1 のとき 1 件を返す（デフォルト遅延 60 秒後）", () => {
    const result = calcPostedAtOffsets({ baseTime: base, count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].getTime()).toBe(base.getTime() + 60_000);
  });

  it("count=3 のとき 3 件を 30 秒間隔で返す", () => {
    const result = calcPostedAtOffsets({ baseTime: base, count: 3 });
    expect(result).toHaveLength(3);
    expect(result[0].getTime()).toBe(base.getTime() + 60_000);
    expect(result[1].getTime()).toBe(base.getTime() + 90_000);
    expect(result[2].getTime()).toBe(base.getTime() + 120_000);
  });

  it("カスタム baseDelayMs / intervalMs を使う", () => {
    const result = calcPostedAtOffsets({ baseTime: base, count: 2, options: { baseDelayMs: 10_000, intervalMs: 5_000 } });
    expect(result[0].getTime()).toBe(base.getTime() + 10_000);
    expect(result[1].getTime()).toBe(base.getTime() + 15_000);
  });

  it("baseTime を変更しない（純粋関数）", () => {
    const original = base.getTime();
    calcPostedAtOffsets({ baseTime: base, count: 3 });
    expect(base.getTime()).toBe(original);
  });

  it("返却した Date を変更しても他の要素に影響しない", () => {
    const result = calcPostedAtOffsets({ baseTime: base, count: 2 });
    const t0 = result[0].getTime();
    result[0].setFullYear(2000);
    expect(result[1].getTime()).not.toBe(t0 - 30_000);
    expect(result[0].getTime()).not.toBe(t0);
  });
});
