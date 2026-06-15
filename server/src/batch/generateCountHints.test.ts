import { describe, expect, it } from "vitest";

import { generateCountHints, pickInRange } from "./generateCountHints.js";

describe("pickInRange (#557)", () => {
  it("min = max のとき必ず min を返す", () => {
    expect(pickInRange(3, 3, () => 0)).toBe(3);
    expect(pickInRange(3, 3, () => 0.5)).toBe(3);
    expect(pickInRange(3, 3, () => 0.9999)).toBe(3);
  });

  it("rng = 0 のとき min を返す", () => {
    expect(pickInRange(1, 5, () => 0)).toBe(1);
    expect(pickInRange(2, 8, () => 0)).toBe(2);
  });

  it("rng が限りなく 1 に近いとき max を返す", () => {
    // rng = 1 - epsilon で max になる（floor((max - min + 1) * rng) + min = max）
    expect(pickInRange(1, 5, () => 0.9999)).toBe(5);
    expect(pickInRange(2, 8, () => 0.9999)).toBe(8);
  });

  it("範囲内の整数を返す（境界端を含む）", () => {
    const min = 2;
    const max = 4;
    const values = new Set<number>();

    // rng が 0, 0.33, 0.66, 0.99 のときの値を確認
    for (let i = 0; i <= 100; i++) {
      const val = pickInRange(min, max, () => i / 101);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      values.add(val);
    }

    // 全ての値（2, 3, 4）が出現する
    expect(values.has(2)).toBe(true);
    expect(values.has(3)).toBe(true);
    expect(values.has(4)).toBe(true);
  });

  it("min = 0, max = 0 のとき 0 を返す", () => {
    expect(pickInRange(0, 0, () => 0)).toBe(0);
  });

  it("min = 1, max = 1 のとき 1 を返す（境界端）", () => {
    expect(pickInRange(1, 1, () => 0)).toBe(1);
    expect(pickInRange(1, 1, () => 0.9999)).toBe(1);
  });
});

describe("generateCountHints (#557)", () => {
  it("rng 注入で決定的に postCount と commentCount が決まる", () => {
    // rng = 0 のとき、postCount = postRange.min, commentCount = commentRange.min
    const result = generateCountHints(
      { min: 1, max: 3 },
      { min: 1, max: 3 },
      () => 0,
    );
    expect(result.postCount).toBe(1);
    expect(result.commentCount).toBe(1);
  });

  it("rng が高い値のとき postCount と commentCount は max に近い", () => {
    const result = generateCountHints(
      { min: 1, max: 3 },
      { min: 1, max: 3 },
      () => 0.9999,
    );
    expect(result.postCount).toBe(3);
    expect(result.commentCount).toBe(3);
  });

  it("postRange が min = max = 2 のとき postCount は常に 2", () => {
    const resultLow = generateCountHints({ min: 2, max: 2 }, { min: 1, max: 5 }, () => 0);
    const resultHigh = generateCountHints({ min: 2, max: 2 }, { min: 1, max: 5 }, () => 0.9999);
    expect(resultLow.postCount).toBe(2);
    expect(resultHigh.postCount).toBe(2);
  });

  it("commentRange が min = max = 2 のとき commentCount は常に 2", () => {
    const resultLow = generateCountHints({ min: 1, max: 5 }, { min: 2, max: 2 }, () => 0);
    const resultHigh = generateCountHints({ min: 1, max: 5 }, { min: 2, max: 2 }, () => 0.9999);
    expect(resultLow.commentCount).toBe(2);
    expect(resultHigh.commentCount).toBe(2);
  });

  it("返す値は整数である", () => {
    const result = generateCountHints({ min: 1, max: 10 }, { min: 0, max: 5 }, () => 0.5);
    expect(Number.isInteger(result.postCount)).toBe(true);
    expect(Number.isInteger(result.commentCount)).toBe(true);
  });

  it("postCount は postRange の範囲内に収まる", () => {
    for (let i = 0; i <= 100; i++) {
      const result = generateCountHints({ min: 2, max: 5 }, { min: 1, max: 3 }, () => i / 101);
      expect(result.postCount).toBeGreaterThanOrEqual(2);
      expect(result.postCount).toBeLessThanOrEqual(5);
    }
  });

  it("commentCount は commentRange の範囲内に収まる", () => {
    for (let i = 0; i <= 100; i++) {
      const result = generateCountHints({ min: 1, max: 3 }, { min: 0, max: 4 }, () => i / 101);
      expect(result.commentCount).toBeGreaterThanOrEqual(0);
      expect(result.commentCount).toBeLessThanOrEqual(4);
    }
  });
});
