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
