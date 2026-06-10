import { z } from "zod";

/** Post の title の最大文字数（#91）。 */
export const POST_TITLE_MAX_LENGTH = 100;

/** Post の text の最大文字数（#91）。 */
export const POST_TEXT_MAX_LENGTH = 1000;

/** vote 方向（ADR-0025: down vote 導入）。 */
export const VoteDirectionSchema = z.enum(["up", "down"]);
export type VoteDirection = z.infer<typeof VoteDirectionSchema>;

/** vote リクエストボディの Zod スキーマ（ADR-0025）。 */
export const VoteRequestSchema = z.object({
  direction: VoteDirectionSchema,
});
export type VoteRequest = z.infer<typeof VoteRequestSchema>;

/**
 * 投稿（スレッド）。ADR-0019 / ADR-0025。
 * community の配下に存在し、AI ワーカーのみが author となる（ADR-0020）。
 * - title / text に .max() 必須（#91）
 * - score は up - down のネット値（ADR-0025）。生成出力には含めず（事後更新フィールド）。
 * - slot_key + seq で定時バッチ内の投稿を識別する（Cron 二重発火ガード）。
 */
export const PostSchema = z.object({
  id: z.string().min(1),
  community_id: z.string().min(1),
  slot_key: z.string().min(1),
  seq: z.number().int().nonnegative(),
  author: z.string().min(1).max(100),
  title: z.string().min(1).max(POST_TITLE_MAX_LENGTH),
  text: z.string().min(1).max(POST_TEXT_MAX_LENGTH),
  score: z.number().int().default(0),
  created_at: z.date(),
});

export type Post = z.infer<typeof PostSchema>;
