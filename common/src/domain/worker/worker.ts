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
  /** 文章量設定（#625）。略略時は standard 相当。 */
  verbosity: WorkerVerbositySchema.optional(),
  imageUrl: z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type Worker = z.infer<typeof WorkerSchema>;

export const UpdateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH).optional(),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(WORKER_PERSONALITY_MAX_LENGTH).optional(),
  /** 文章量設定（#625）。略略時は変更なし。 */
  verbosity: WorkerVerbositySchema.optional(),
});

export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;

export const CreateWorkerSchema = z.object({
  displayName: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(WORKER_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(WORKER_PERSONALITY_MAX_LENGTH).optional(),
  /** 文章量設定（#625）。略略時は standard 相当。 */
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

const DICEBEAR_BASE_URL = "https://api.dicebear.com/9.x/bottts-neutral/svg";

/** ワーカー ID をシードとした DiceBear 自動生成アバター URL を返す（#884）。 */
export function generateWorkerAvatarUrl({ id }: { id: string }): string {
  return `${DICEBEAR_BASE_URL}?seed=${encodeURIComponent(id)}`;
}

/**
 * imageUrl が設定されていればそれを返し、未設定なら DiceBear 自動生成 URL を返す（#884）。
 * 画面表示で Avatar の src に渡す単一情報源として使う。
 */
export function resolveWorkerImageUrl({ id, imageUrl }: { id: string; imageUrl?: string | null }): string {
  return imageUrl ?? generateWorkerAvatarUrl({ id });
}

export const createAvatarUrlResolver = (
  workers: readonly Worker[] = DEFAULT_WORKERS,
): ((workerId: string) => string | undefined) => {
  const workerById = new Map(workers.map((w) => [w.id, w]));
  return (workerId: string): string | undefined => {
    const worker = workerById.get(workerId);
    if (!worker) return undefined;
    return resolveWorkerImageUrl({ id: workerId, imageUrl: worker.imageUrl });
  };
};
