import { z } from "zod";

export const WORKER_DISPLAY_NAME_MAX_LENGTH = 50;
export const WORKER_ROLE_MAX_LENGTH = 50;
export const WORKER_PERSONALITY_MAX_LENGTH = 500;
/** 画像 URL の最大文字数（#220・#91）。 */
export const WORKER_IMAGE_URL_MAX_LENGTH = 500;
/** avatarUrl フィールドは #541 で削除済みだが、定数は将来の利用に備えて保持する（#592）。 */
export const WORKER_AVATAR_URL_MAX_LENGTH = 2048;

/**
 * ワーカーの文章量設定（#625）。
 * - concise: 簡潔（1、2 文程度）
 * - standard: 標準（既定）
 * - detailed: 詳細（具体例や背景を交えてやや詳しめ）
 */
export const WorkerVerbositySchema = z.enum(["concise", "standard", "detailed"]);
export type WorkerVerbosity = z.infer<typeof WorkerVerbositySchema>;

export const WorkerSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(WORKER_PERSONALITY_MAX_LENGTH).optional(),
  /** 文章量設定（#625）。策略時は standard 相当。 */
  verbosity: WorkerVerbositySchema.optional(),
  imageUrl: z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type Worker = z.infer<typeof WorkerSchema>;

export const UpdateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH).optional(),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(WORKER_PERSONALITY_MAX_LENGTH).optional(),
  /** 文章量設定（#625）。策略時は変更なし。 */
  verbosity: WorkerVerbositySchema.optional(),
});

export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;

export const CreateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(WORKER_PERSONALITY_MAX_LENGTH).optional(),
  /** 文章量設定（#625）。策略時は standard 相当。 */
  verbosity: WorkerVerbositySchema.optional(),
});

export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;

/** ページネーションの 1 ページあたり件数の上限（#545）。 */
export const WORKER_PAGINATION_LIMIT_MAX = 100;

/** GET /api/workers のクエリパラメータスキーマ（#545）。 */
export const WorkerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(9999).optional(),
  limit: z.coerce.number().int().min(1).max(WORKER_PAGINATION_LIMIT_MAX).optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export type WorkerListQuery = z.infer<typeof WorkerListQuerySchema>;

/** GET /api/workers のレスポンススキーマ（ページネーション対応・#545）。 */
export const WorkerListResponseSchema = z.object({
  workers: z.array(WorkerSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
});

export type WorkerListResponse = z.infer<typeof WorkerListResponseSchema>;

export const DEFAULT_WORKERS: readonly Worker[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー" },
  { id: "ken", displayName: "ken", role: "ベテラン" },
  { id: "mei", displayName: "mei", role: "新人" },
];

export const formatWorkerDisplayName = (worker: {
  displayName: string;
  deletedAt?: Date | string | null;
}): string => {
  if (worker.deletedAt != null) {
    return `》削除済み《${worker.displayName}`;
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
