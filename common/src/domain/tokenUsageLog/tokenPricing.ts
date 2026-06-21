/** モデル別の API 単価（per 1M トークン、2026-06 時点）。 */
export const MODEL_PRICING = {
  "claude-sonnet-4-6": { inputPerMToken: 3, outputPerMToken: 15 },
  "claude-haiku-4-5": { inputPerMToken: 1, outputPerMToken: 5 },
} as const satisfies Record<string, { inputPerMToken: number; outputPerMToken: number }>;

/**
 * モデル・入力・出力トークン数から API 利用コスト（USD）を算出する純粋関数。
 * 未知モデルは 0 を返し、既存のトークン数表示を壊さない。
 */
export function calculateCostUsd({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing) return 0;
  return (inputTokens * pricing.inputPerMToken + outputTokens * pricing.outputPerMToken) / 1_000_000;
}
