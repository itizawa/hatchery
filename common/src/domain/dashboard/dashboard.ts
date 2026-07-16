import { z } from "zod";

import { COMMUNITY_NAME_MAX_LENGTH, COMMUNITY_SLUG_MAX_LENGTH } from "../community/community.js";

/** community_id の最大文字数（UUID 相当。余裕を持たせ 256 文字上限）（#1113）。 */
export const DASHBOARD_COMMUNITY_ID_MAX_LENGTH = 256;

/**
 * GET /api/dashboard のコミュニティ別内訳 1 件（#1113）。
 * サイト全体の定量サマリ画面で、community 別の投稿数・購読者数・累計閲覧数を表示するために使う。
 */
export const DashboardCommunityBreakdownSchema = z.object({
  community_id: z.string().min(1).max(DASHBOARD_COMMUNITY_ID_MAX_LENGTH),
  slug: z.string().min(1).max(COMMUNITY_SLUG_MAX_LENGTH),
  name: z.string().min(1).max(COMMUNITY_NAME_MAX_LENGTH),
  post_count: z.number().int().nonnegative(),
  subscriber_count: z.number().int().nonnegative(),
  view_count: z.number().int().nonnegative(),
});
export type DashboardCommunityBreakdown = z.infer<typeof DashboardCommunityBreakdownSchema>;

/**
 * GET /api/dashboard のレスポンススキーマ（#1113）。
 * 個人に紐づかないサイト全体の集計値（コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・
 * 累計 vote 数・購読数）と、コミュニティ別内訳（view_count 降順）を返す。認証不要で全ユーザーに公開する。
 */
export const DashboardSummarySchema = z.object({
  /** サイト全体のコミュニティ数。 */
  community_count: z.number().int().nonnegative(),
  /** サイト全体の bot worker 数（論理削除済みは除く）。 */
  worker_count: z.number().int().nonnegative(),
  /** サイト全体の post 総数。 */
  post_count: z.number().int().nonnegative(),
  /** サイト全体の comment 総数。 */
  comment_count: z.number().int().nonnegative(),
  /** サイト全体の累計閲覧数（Post + Comment の viewCount 合計）。 */
  total_view_count: z.number().int().nonnegative(),
  /** サイト全体の vote 総数。 */
  total_vote_count: z.number().int().nonnegative(),
  /** サイト全体の購読総数。 */
  total_subscription_count: z.number().int().nonnegative(),
  /** コミュニティ別内訳（view_count 降順）。 */
  communities: z.array(DashboardCommunityBreakdownSchema),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
