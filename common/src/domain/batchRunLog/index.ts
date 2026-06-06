import { z } from "zod";

export const BatchRunLogStatusSchema = z.enum(["success", "failure"]);
export type BatchRunLogStatus = z.infer<typeof BatchRunLogStatusSchema>;

export const BatchRunLogRecordSchema = z.object({
  id: z.string().min(1),
  executedAt: z.coerce.date(),
  status: BatchRunLogStatusSchema,
  messageCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),
});
export type BatchRunLogRecord = z.infer<typeof BatchRunLogRecordSchema>;
