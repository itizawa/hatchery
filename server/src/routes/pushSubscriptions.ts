import { Router } from "express";
import { SubscribePushBodySchema, UnsubscribePushBodySchema } from "@hatchery/common";

import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { PushSubscriptionRepository } from "../persistence/pushSubscriptionRepository.js";

/** /api/push-subscriptions ルータ（#798）。認証ユーザーの Web Push 購読登録・削除 API。 */
export function createPushSubscriptionsRouter({
  pushSubscriptionRepository,
}: {
  pushSubscriptionRepository: PushSubscriptionRepository;
}): Router {
  const router = Router();

  // 購読登録（upsert）（認証必須）
  // eslint-disable-next-line max-params
  router.post("/", requireAuth, validateBody(SubscribePushBodySchema), (req, res, next) => {
    const userId = getAuthUser(req).id;
    const { endpoint, p256dh, auth } = req.body as { endpoint: string; p256dh: string; auth: string };

    pushSubscriptionRepository
      .upsert({ userId, endpoint, p256dh, auth })
      .then(() => res.status(201).json({ ok: true }))
      .catch(next);
  });

  // 購読削除（認証必須）
  // eslint-disable-next-line max-params
  router.delete("/", requireAuth, validateBody(UnsubscribePushBodySchema), (req, res, next) => {
    const { endpoint } = req.body as { endpoint: string };

    pushSubscriptionRepository
      .delete(endpoint)
      .then(() => res.status(204).send())
      .catch(next);
  });

  return router;
}
