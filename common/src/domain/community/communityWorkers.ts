import { z } from "zod";

import { FEED_CURSOR_MAX_LENGTH } from "../feed/feed.js";
import { WorkerSchema } from "../worker/worker.js";

/**
 * コミュニティ所属ワーカー一覧取得クエリのスキーマ（#1078）。cursor・limit を検証する。
 * cursor の上限は feed.ts の FEED_CURSOR_MAX_LENGTH と同じ考え方（base64(JSON{id}) で十分に収まる余裕を持たせた値）。
 */
export const CommunityWorkersQuerySchema = z.object({
  cursor: z.string().max(FEED_CURSOR_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CommunityWorkersQuery = z.infer<typeof CommunityWorkersQuerySchema>;

/**
 * コミュニティ所属ワーカー一覧レスポンスのスキーマ（#1078）。カーソルページネーション形式。
 * GET /api/communities/{slug}/workers の戻り値。
 */
export const CommunityWorkersResponseSchema = z.object({
  items: z.array(WorkerSchema),
  nextCursor: z.string().max(FEED_CURSOR_MAX_LENGTH).nullable(),
});

export type CommunityWorkersResponse = z.infer<typeof CommunityWorkersResponseSchema>;
