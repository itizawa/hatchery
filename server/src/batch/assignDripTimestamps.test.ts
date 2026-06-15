import { describe, expect, it } from "vitest";

import { assignDripTimestamps } from "./assignDripTimestamps.js";

describe("assignDripTimestamps (#556)", () => {
  const slotAt = new Date("2026-06-15T09:00:00Z");
  const windowMs = 3 * 60 * 60 * 1000; // 3 時間

  it("件数 0 のときは空配列を返す", () => {
    const result = assignDripTimestamps({ slotAt, windowMs, count: 0, rng: () => 0 });
    expect(result).toEqual([]);
  });

  it("件数 1 のとき 1 件のタイムスタンプを返す", () => {
    const result = assignDripTimestamps({ slotAt, windowMs, count: 1, rng: () => 0.5 });
    expect(result).toHaveLength(1);
    const t = result[0]!;
    expect(t.getTime()).toBeGreaterThanOrEqual(slotAt.getTime());
    expect(t.getTime()).toBeLessThan(slotAt.getTime() + windowMs);
  });

  it("rng=0 固定: 各タイムスタンプがスロット時刻以降である", () => {
    const result = assignDripTimestamps({ slotAt, windowMs, count: 5, rng: () => 0 });
    for (const t of result) {
      expect(t.getTime()).toBeGreaterThanOrEqual(slotAt.getTime());
    }
  });

  it("rng=1 固定: 全タイムスタンプが windowMs 未満の範囲に収まる", () => {
    const result = assignDripTimestamps({ slotAt, windowMs, count: 5, rng: () => 1 });
    for (const t of result) {
      expect(t.getTime()).toBeLessThan(slotAt.getTime() + windowMs);
    }
  });

  it("単調増加: 後のタイムスタンプは前以上", () => {
    // rng をシーケンシャルに変える（0.2, 0.4, 0.6, ...）
    let call = 0;
    const rng = () => ((call++ % 5) + 1) * 0.2;
    const result = assignDripTimestamps({ slotAt, windowMs, count: 5, rng });
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.getTime()).toBeGreaterThanOrEqual(result[i - 1]!.getTime());
    }
  });

  it("全タイムスタンプが [slotAt, slotAt + windowMs) の範囲内", () => {
    let call = 0;
    const rng = () => ((call++ % 10) + 1) / 11;
    const result = assignDripTimestamps({ slotAt, windowMs, count: 10, rng });
    for (const t of result) {
      expect(t.getTime()).toBeGreaterThanOrEqual(slotAt.getTime());
      expect(t.getTime()).toBeLessThan(slotAt.getTime() + windowMs);
    }
  });

  it("rng 決定化: 同一 rng で同一結果を返す（決定性テスト）", () => {
    const makeRng = () => {
      let n = 0;
      return () => (n++ * 0.1 + 0.05) % 1;
    };
    const result1 = assignDripTimestamps({ slotAt, windowMs, count: 4, rng: makeRng() });
    const result2 = assignDripTimestamps({ slotAt, windowMs, count: 4, rng: makeRng() });
    expect(result1.map((d) => d.getTime())).toEqual(result2.map((d) => d.getTime()));
  });

  it("件数が 1 でも slotAt より後のタイムスタンプを返す（rng=0）", () => {
    // offset_0 = rng() * (windowMs / count) = 0 * windowMs = 0 → slotAt そのものは許容
    const result = assignDripTimestamps({ slotAt, windowMs, count: 1, rng: () => 0 });
    expect(result[0]!.getTime()).toBeGreaterThanOrEqual(slotAt.getTime());
  });
});
