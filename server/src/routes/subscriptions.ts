import { Router } from "express";

import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";

/**
 * /api/subscriptions ルータ（#933）。
 * - GET /unread-counts: 購読コミュニティ別の未読数一覧（認証必須）
 */
export function createSubscriptionsRouter(subscriptionRepo: SubscriptionRepository): Router {
  const router = Router();

  // 購読コミュニティ別未読数一覧（認証必須・#933）
  // eslint-disable-next-line max-params
  router.get("/unread-counts", requireAuth, (req, res, next) => {
    const userId = getAuthUser(req).id;
    subscriptionRepo
      .listWithUnreadCounts(userId)
      .then((entries) =>
        res.status(200).json({
          unread_counts: entries.map((e) => ({
            community_id: e.communityId,
            community_slug: e.communitySlug,
            unread_count: e.unreadCount,
          })),
        }),
      )
      .catch(next);
  });

  return router;
}
