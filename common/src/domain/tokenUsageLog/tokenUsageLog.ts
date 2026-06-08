import { z } from "zod";

export const TokenUsageLogSchema = z.object({
  id: z.string(),
  occurredAt: z.coerce.date(),
  /** モデル名（例: "claude-haiku-4-5"）。最大 100 文字。 */
  model: z.string().min(1).max(100),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  /** 紐づくバッチ実行ログ ID（任意）。 */
  batchRunLogId: z.string().nullable(),
});
export type TokenUsageLog = z.infer<typeof TokenUsageLogSchema>;
