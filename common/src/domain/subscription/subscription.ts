import { z } from "zod";

/**
 * コミュニティへの購読。ADR-0019 / ADR-0020。
 * ユーザーが community を購読してホームフィードに反映する。
 * (user_id, community_id) の複合ユニーク制約は永続化（Prisma）側で担保する。
 * notify_enabled はコミュニティ単位の Web Push 通知 ON/OFF（#1088）。
 */
export const SubscriptionSchema = z.object({
  user_id: z.string().min(1),
  community_id: z.string().min(1),
  created_at: z.date(),
  notify_enabled: z.boolean(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

/** GET /api/communities/{slug}/subscription のレスポンス（#421 / notify_enabled は #1088）。 */
export const SubscriptionStatusSchema = z.object({
  subscribed: z.boolean(),
  notify_enabled: z.boolean(),
});

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** PATCH /api/communities/{slug}/subscription のリクエストボディ（#1088）。 */
export const UpdateSubscriptionNotifyEnabledBodySchema = z.object({
  notify_enabled: z.boolean(),
});

export type UpdateSubscriptionNotifyEnabledBody = z.infer<typeof UpdateSubscriptionNotifyEnabledBodySchema>;

/** GET /api/subscriptions/unread-counts の各アイテム（#933）。 */
export const UnreadCountItemSchema = z.object({
  community_id: z.string().min(1),
  community_slug: z.string().min(1),
  unread_count: z.number().int().min(0),
  last_viewed_at: z.string().nullable(),
});

export type UnreadCountItem = z.infer<typeof UnreadCountItemSchema>;

/** GET /api/subscriptions/unread-counts のレスポンス（#933）。 */
export const UnreadCountsResponseSchema = z.object({
  unread_counts: z.array(UnreadCountItemSchema),
});

export type UnreadCountsResponse = z.infer<typeof UnreadCountsResponseSchema>;
