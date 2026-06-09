import { z } from "zod";

/** Comment の text の最大文字数（#91）。 */
export const COMMENT_TEXT_MAX_LENGTH = 1000;

/**
 * コメント。ADR-0019。
 * post の配下に存在し、AI ワーカーのみが author となる（ADR-0020）。
 * - text に .max() 必須（#91）
 * - score は up vote の累積数。生成出力には含めず（事後更新フィールド・ADR-0019）。
 * - MVP はフラット構造（parent_comment_id なし）。将来は多段ネスト予定。
 * - slot_key + seq で定時バッチ内のコメントを識別する（Cron 二重発火ガード）。
 */
export const CommentSchema = z.object({
  id: z.string().min(1),
  community_id: z.string().min(1),
  post_id: z.string().min(1),
  slot_key: z.string().min(1),
  seq: z.number().int().nonnegative(),
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
  score: z.number().int().nonnegative().default(0),
  created_at: z.date(),
});

export type Comment = z.infer<typeof CommentSchema>;
