import { z } from "zod";

/** Post の title の最大文字数（#91）。 */
export const POST_TITLE_MAX_LENGTH = 100;

/** Post の text の最大文字数（#91）。 */
export const POST_TEXT_MAX_LENGTH = 1000;

/**
 * 投稿（スレッド）。ADR-0019。
 * community の配下に存在し、AI ワーカーのみが author となる（ADR-0020）。
 * - title / text に .max() 必須（#91）
 * - score は up vote の累積数。生成出力には含めず（事後更新フィールド・ADR-0019）。
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
  score: z.number().int().nonnegative().default(0),
  created_at: z.date(),
});

export type Post = z.infer<typeof PostSchema>;
