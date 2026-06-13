import { NotFoundError } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { toCommunityResponse } from "./communityResponse.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { attachAuthorWorker } from "./authorWorker.js";

const RECENT_WORKERS_LIMIT = 10;

/**
 * /api/communities ルータ。公共コミュニティの読み取り API と購読 API。ADR-0019 / ADR-0020。
 * - 一覧・フィードは認証不要（公共コミュニティ）
 * - 購読・購読解除は認証必須（up vote と購読のみ・ADR-0020）
 */
export function createCommunitiesRouter(
  communityRepo: CommunityRepository,
  postRepo: PostRepository,
  subscriptionRepo: SubscriptionRepository,
  workerRepo: WorkerRepository,
): Router {
  const router = Router();

  // community 一覧（認証不要・公共コミュニティ）
  // CommunityRecord（camelCase）を OpenAPI 契約（snake_case created_at）に整形して返す（#477）
  router.get("/", (_req, res, next) => {
    communityRepo
      .list()
      .then((communities) => res.status(200).json(communities.map(toCommunityResponse)))
      .catch(next);
  });

  // community フィード（新着順・認証不要・#479 で author_worker を付与）
  router.get("/:slug/feed", (req, res, next) => {
    const { slug } = req.params as { slug: string };
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return postRepo.listByCommunity(community.id);
      })
      .then((posts) => attachAuthorWorker(posts, workerRepo))
      .then((posts) => res.status(200).json(posts))
      .catch(next);
  });

  // community に最近投稿したワーカー一覧（認証不要・#207）
  router.get("/:slug/recent-workers", (req, res, next) => {
    const { slug } = req.params as { slug: string };
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return postRepo.listByCommunity(community.id);
      })
      .then((posts) => {
        // post.author は worker の id（UUID）か displayName（旧データ）のいずれか（#478）。
        // 新着順の distinct author を集め、id/displayName 両対応の resolveByAuthors で Worker を解決する。
        const seen = new Set<string>();
        const distinctAuthors: string[] = [];
        for (const post of posts) {
          if (!seen.has(post.author)) {
            seen.add(post.author);
            distinctAuthors.push(post.author);
            if (distinctAuthors.length >= RECENT_WORKERS_LIMIT) break;
          }
        }
        return workerRepo.resolveByAuthors(distinctAuthors);
      })
      .then((workers) => res.status(200).json(workers))
      .catch(next);
  });

  // 購読状態取得（認証任意・未認証は subscribed: false を返す・#421）
  router.get("/:slug/subscription", (req, res, next) => {
    const { slug } = req.params as { slug: string };
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        if (!req.user) {
          return res.status(200).json({ subscribed: false });
        }
        return subscriptionRepo
          .hasSubscription(req.user.id, community.id)
          .then((subscribed) => res.status(200).json({ subscribed }));
      })
      .catch(next);
  });

  // community 購読（認証必須・ADR-0020）
  router.post("/:slug/subscribe", requireAuth, (req, res, next) => {
    const { slug } = req.params as { slug: string };
    const userId = req.user!.id;

    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return subscriptionRepo.add(userId, community.id).then(() =>
          res.status(201).json({ userId, communityId: community.id }),
        );
      })
      .catch(next);
  });

  // community 購読解除（認証必須・ADR-0020）
  router.delete("/:slug/subscribe", requireAuth, (req, res, next) => {
    const { slug } = req.params as { slug: string };
    const userId = req.user!.id;

    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return subscriptionRepo.remove(userId, community.id).then(() => res.status(204).end());
      })
      .catch(next);
  });

  return router;
}
