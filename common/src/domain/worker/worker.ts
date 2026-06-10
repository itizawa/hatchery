import { z } from "zod";

export const WORKER_DISPLAY_NAME_MAX_LENGTH = 50;
export const WORKER_ROLE_MAX_LENGTH = 50;
/** 画像 URL の最大文字数（#220・#91）。 */
export const WORKER_IMAGE_URL_MAX_LENGTH = 500;

export const WorkerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  isBot: z.boolean().default(false),
  personality: z.string().max(500).optional(),
  imageUrl: z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).optional(),
  avatarUrl: z.string().url().max(2048).optional(),
  deletedAt: z.union([z.string().datetime(), z.date()]).nullable().optional(),
});

export type Worker = z.infer<typeof WorkerSchema>;

export const UpdateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH).optional(),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(500).optional(),
});

export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;

export const CreateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(500).optional(),
});

export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;

export const DEFAULT_WORKERS: readonly Worker[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", isBot: true },
  { id: "ken", displayName: "ken", role: "ベテラン", isBot: true },
  { id: "mei", displayName: "mei", role: "新人", isBot: true },
];

export const formatWorkerDisplayName = (worker: {
  displayName: string;
  deletedAt?: Date | string | null;
}): string => {
  if (worker.deletedAt != null) {
    return `【削除済み】${worker.displayName}`;
  }
  return worker.displayName;
};

export const createDisplayNameResolver = (
  workers: readonly Worker[] = DEFAULT_WORKERS,
): ((workerId: string) => string) => {
  const displayNameById = new Map(
    workers.map((w) => [w.id, formatWorkerDisplayName({ displayName: w.displayName, deletedAt: w.deletedAt ?? null })]),
  );
  return (workerId: string): string => displayNameById.get(workerId) ?? workerId;
};

export const createAvatarUrlResolver = (
  workers: readonly Worker[] = DEFAULT_WORKERS,
): ((workerId: string) => string | undefined) => {
  const imageUrlById = new Map(workers.map((w) => [w.id, w.imageUrl]));
  return (workerId: string): string | undefined => imageUrlById.get(workerId);
};

// ── 後方互換エクスポート（Employee → Worker リネーム #329） ────────────────────────
/** @deprecated Use WorkerSchema */
export const EmployeeSchema = WorkerSchema;
/** @deprecated Use Worker */
export type Employee = Worker;
/** @deprecated Use UpdateWorkerSchema */
export const UpdateEmployeeSchema = UpdateWorkerSchema;
/** @deprecated Use UpdateWorkerInput */
export type UpdateEmployeeInput = UpdateWorkerInput;
/** @deprecated Use CreateWorkerSchema */
export const CreateEmployeeSchema = CreateWorkerSchema;
/** @deprecated Use CreateWorkerInput */
export type CreateEmployeeInput = CreateWorkerInput;
/** @deprecated Use DEFAULT_WORKERS */
export const DEFAULT_EMPLOYEES = DEFAULT_WORKERS;
/** @deprecated Use WORKER_DISPLAY_NAME_MAX_LENGTH */
export const EMPLOYEE_DISPLAY_NAME_MAX_LENGTH = WORKER_DISPLAY_NAME_MAX_LENGTH;
/** @deprecated Use WORKER_ROLE_MAX_LENGTH */
export const EMPLOYEE_ROLE_MAX_LENGTH = WORKER_ROLE_MAX_LENGTH;
/** @deprecated Use WORKER_IMAGE_URL_MAX_LENGTH */
export const EMPLOYEE_IMAGE_URL_MAX_LENGTH = WORKER_IMAGE_URL_MAX_LENGTH;
/** @deprecated Use formatWorkerDisplayName */
export const formatEmployeeDisplayName = formatWorkerDisplayName;
/** @deprecated Use createDisplayNameResolver */
export const createWorkerDisplayNameResolver = createDisplayNameResolver;
/** @deprecated Use createAvatarUrlResolver */
export const createWorkerAvatarUrlResolver = createAvatarUrlResolver;
