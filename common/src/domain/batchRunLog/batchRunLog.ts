import { z } from "zod";

export const BatchRunLogStatusSchema = z.enum(["success", "failure"]);
export type BatchRunLogStatus = z.infer<typeof BatchRunLogStatusSchema>;

export const BatchRunLogSchema = z.object({
  id: z.string(),
  executedAt: z.coerce.date(),
  status: BatchRunLogStatusSchema,
  messageCount: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),
});
export type BatchRunLog = z.infer<typeof BatchRunLogSchema>;
