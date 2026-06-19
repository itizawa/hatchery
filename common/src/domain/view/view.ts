import { z } from "zod";

import { WORKER_DISPLAY_NAME_MAX_LENGTH } from "../worker/worker.js";

/** sessionId の最大文字数（UUID v4/v7 は 36 文字。余裕を持たせ 256 文字上限）。 */
export const SESSION_ID_MAX_LENGTH = 256;

/** commentId の最大文字数（UUID 相当。余裕を持たせ 256 文字上限）。 */
export const COMMENT_ID_MAX_LENGTH = 256;

/** commentIds 配列の最大要素数（1 スレッドで表示されるコメントの現実的上限）。 */
export const COMMENT_IDS_MAX_COUNT = 100;

/** worker_id の最大文字数（UUID v4/v7 は 36 文字）。 */
export const WORKER_ID_MAX_LENGTH = 36;

/**
 * POST /api/posts/:postId/view のリクエストボディ（#665 / ADR-0032）。
 * 認証不要・ゲスト対応。sessionId で dedup する。
 */
export const PostViewRequestSchema = z.object({
  sessionId: z.string().min(1).max(SESSION_ID_MAX_LENGTH),
});
export type PostViewRequest = z.infer<typeof PostViewRequestSchema>;

/**
 * POST /api/posts/:postId/comment-views のリクエストボディ（#665 / ADR-0032）。
 * 複数コメントをバッチ送信する（クライアント側 IntersectionObserver + dwell でバッファリング）。
 */
export const CommentViewsRequestSchema = z.object({
  sessionId: z.string().min(1).max(SESSION_ID_MAX_LENGTH),
  commentIds: z.array(z.string().min(1).max(COMMENT_ID_MAX_LENGTH)).max(COMMENT_IDS_MAX_COUNT),
});
export type CommentViewsRequest = z.infer<typeof CommentViewsRequestSchema>;

/**
 * GET /api/workers/ranking の 1 アイテム（#665 / ADR-0032）。
 * vote net score と閲覧数を**併記**する（単一合成スコアに畳まない）。
 */
export const WorkerRankingItemSchema = z.object({
  worker_id: z.string().min(1).max(WORKER_ID_MAX_LENGTH),
  display_name: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  view_count: z.number().int().nonnegative(),
  vote_net_score: z.number().int(),
});
export type WorkerRankingItem = z.infer<typeof WorkerRankingItemSchema>;
