import { z } from "zod";

/** MVP のタスク状態は new → done の 2 値のみ（picked/dropped は Phase 1）。 */
export const TaskStatusSchema = z.enum(["new", "done"]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** 社員が抱えるタスク。MVP では id・text・status の最小構成。 */
export const TaskSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  status: TaskStatusSchema,
});

export type Task = z.infer<typeof TaskSchema>;
