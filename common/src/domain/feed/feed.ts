import { z } from "zod";

import { PostSchema } from "../post/post.js";

/** カーソルの最大長。base64(JSON{ createdAt, id }) で最大 ~100 chars。余裕を持って 512。 */
export const FEED_CURSOR_MAX_LENGTH = 512;

/** ホームフィードの並び順（#435）。latest=新着順 / popular=vote 数（score）降順。 */
export const HomeFeedSortSchema = z.enum(["latest", "popular"]);

export type HomeFeedSort = z.infer<typeof HomeFeedSortSchema>;

/** ホームフィード取得クエリのスキーマ（#367 / #435）。cursor・limit・sort を検証する。 */
export const HomeFeedQuerySchema = z.object({
  cursor: z.string().max(FEED_CURSOR_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: HomeFeedSortSchema.default("latest"),
});

export type HomeFeedQuery = z.infer<typeof HomeFeedQuerySchema>;

/** ホームフィードレスポンスのスキーマ（#367）。カーソルページネーション形式。 */
export const HomeFeedResponseSchema = z.object({
  posts: z.array(PostSchema),
  nextCursor: z.string().max(FEED_CURSOR_MAX_LENGTH).nullable(),
});

export type HomeFeedResponse = z.infer<typeof HomeFeedResponseSchema>;

/** コミュニティフィード取得クエリのスキーマ（#881）。cursor・limit を検証する。 */
export const CommunityFeedQuerySchema = z.object({
  cursor: z.string().max(FEED_CURSOR_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>;

/** コミュニティフィードレスポンスのスキーマ（#881）。カーソルページネーション形式。 */
export const CommunityFeedResponseSchema = z.object({
  posts: z.array(PostSchema),
  nextCursor: z.string().max(FEED_CURSOR_MAX_LENGTH).nullable(),
});

export type CommunityFeedResponse = z.infer<typeof CommunityFeedResponseSchema>;
