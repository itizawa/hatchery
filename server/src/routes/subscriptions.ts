import { Router } from "express";

import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";

/** /api/subscriptions ルータ（#933）。認証ユーザーの購読情報 API。 */
export function createSubscriptionsRouter({
  subscriptionRepository,
}: {
  subscriptionRepository: SubscriptionRepository;
}): Router {
  const router = Router();

  // 購読コミュニティ別の未読数（認証必須・#933）
  // eslint-disable-next-line max-params
  router.get("/unread-counts", requireAuth, (req, res, next) => {
    const userId = getAuthUser(req).id;

    subscriptionRepository
      .listWithUnreadCounts(userId)
      .then((items) =>
        res.status(200).json({
          unread_counts: items.map((item) => ({
            community_id: item.communityId,
            community_slug: item.communitySlug,
            unread_count: item.unreadCount,
            last_viewed_at: item.lastViewedAt?.toISOString() ?? null,
          })),
        }),
      )
      .catch(next);
  });

  return router;
}
