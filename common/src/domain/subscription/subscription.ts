import { z } from "zod";

/**
 * コミュニティへの購読。ADR-0019 / ADR-0020。
 * ユーザーが community を購読してホームフィードに反映する。
 * (user_id, community_id) の複合ユニーク制約は永続化（Prisma）側で担保する。
 */
export const SubscriptionSchema = z.object({
  user_id: z.string().min(1),
  community_id: z.string().min(1),
  created_at: z.date(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

/** GET /api/communities/{slug}/subscription のレスポンス（#421）。 */
export const SubscriptionStatusSchema = z.object({
  subscribed: z.boolean(),
});

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** コミュニティ別未読数（#933）。 */
export const UnreadCountSchema = z.object({
  community_id: z.string().min(1),
  community_slug: z.string().min(1),
  unread_count: z.number().int().min(0),
});

export type UnreadCount = z.infer<typeof UnreadCountSchema>;

/** GET /api/subscriptions/unread-counts のレスポンス（#933）。 */
export const UnreadCountsResponseSchema = z.object({
  unread_counts: z.array(UnreadCountSchema),
});

export type UnreadCountsResponse = z.infer<typeof UnreadCountsResponseSchema>;
