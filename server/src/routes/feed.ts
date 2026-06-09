import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";

/**
 * /api/feed ルータ。ホームフィード（認証ユーザーの購読 community の投稿・新着順）。
 * ADR-0019 / ADR-0020。
 * - 認証必須（ユーザーの購読情報が必要）
 * - 購読なしの場合は空配列を返す
 */
export function createFeedRouter(
  subscriptionRepo: SubscriptionRepository,
  postRepo: PostRepository,
): Router {
  const router = Router();

  // ホームフィード（認証必須・購読 community の投稿・新着順）
  router.get("/", requireAuth, (req, res, next) => {
    const userId = req.user!.id;

    subscriptionRepo
      .listCommunityIdsByUser(userId)
      .then((communityIds) => {
        if (communityIds.length === 0) {
          return [];
        }
        return postRepo.listByCommunityIds(communityIds);
      })
      .then((posts) => res.status(200).json(posts))
      .catch(next);
  });

  return router;
}
