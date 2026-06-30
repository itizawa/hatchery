import { describe, expect, it } from "vitest";

import { ALLOWED_BATCH_MODELS, MODEL_PRICING, calculateCostUsd } from "./tokenPricing.js";

describe("ALLOWED_BATCH_MODELS", () => {
  it("全モデルが MODEL_PRICING に含まれる", () => {
    for (const model of ALLOWED_BATCH_MODELS) {
      expect(MODEL_PRICING).toHaveProperty(model);
    }
  });
});

describe("MODEL_PRICING", () => {
  it("claude-sonnet-4-6 の単価を含む", () => {
    expect(MODEL_PRICING["claude-sonnet-4-6"]).toEqual({ inputPerMToken: 3, outputPerMToken: 15 });
  });

  it("claude-haiku-4-5 の単価を含む", () => {
    expect(MODEL_PRICING["claude-haiku-4-5"]).toEqual({ inputPerMToken: 1, outputPerMToken: 5 });
  });
});

describe("calculateCostUsd", () => {
  it("claude-sonnet-4-6: 1M 入力 ($3) + 1M 出力 ($15) = $18", () => {
    expect(
      calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(18);
  });

  it("claude-haiku-4-5: 1M 入力 ($1) + 1M 出力 ($5) = $6", () => {
    expect(
      calculateCostUsd({ model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(6);
  });

  it("未知モデルは 0 を返す（既存表示を壊さない）", () => {
    expect(
      calculateCostUsd({ model: "unknown-model-xyz", inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(0);
  });

  it("トークン数が 0 のときは 0 を返す", () => {
    expect(
      calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 0 }),
    ).toBe(0);
  });

  it("claude-sonnet-4-6: 入力のみコストを計算する", () => {
    expect(
      calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 0 }),
    ).toBe(3);
  });

  it("claude-sonnet-4-6: 出力のみコストを計算する", () => {
    expect(
      calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 0, outputTokens: 1_000_000 }),
    ).toBe(15);
  });

  it("claude-sonnet-4-6: 典型的な 8192 トークンの金額を計算する", () => {
    const cost = calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 8192, outputTokens: 8192 });
    expect(cost).toBeCloseTo((8192 * 3 + 8192 * 15) / 1_000_000, 10);
  });
});
