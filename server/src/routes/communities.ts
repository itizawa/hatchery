import { NotFoundError } from "@hatchery/common";
import { Router } from "express";

import { buildPrivateCacheControl } from "../config/security.js";
import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { toCommunityResponse } from "./communityResponse.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { attachAuthorWorker } from "./authorWorker.js";
import { attachCommentCount } from "./commentCount.js";
import { extractSessionId } from "./extractSessionId.js";
import { toPostResponse } from "./postResponse.js";

const RECENT_WORKERS_LIMIT = 10;

/**
 * /api/communities ルータ。公共コミュニティの読み取り API と購読 API。ADR-0019 / ADR-0020。
 * - 一覧・フィードは認証不要（公共コミュニティ）
 * - 購読・購読解除は認証必須（up vote と購読のみ・ADR-0020）
 * - #831: community フィードでも sessionId 付きのとき my_vote を付与する。
 */
// eslint-disable-next-line max-params
export function createCommunitiesRouter(
  communityRepo: CommunityRepository,
  postRepo: PostRepository,
  subscriptionRepo: SubscriptionRepository,
  workerRepo: WorkerRepository,
  commentRepo: CommentRepository,
  voteRepo: VoteRepository,
): Router {
  const router = Router();

  // community 一覧（認証不要・公共コミュニティ）
  // CommunityRecord（camelCase）を OpenAPI 契約（snake_case created_at）に整形して返す（#477）
  // post_count / last_post_at を活気指標として付与する（N+1 回避・#527）
  // eslint-disable-next-line max-params
  router.get("/", (_req, res, next) => {
    Promise.all([communityRepo.list(), postRepo.getStatsByCommunity()])
      .then(([communities, statsMap]) =>
        res.status(200).json(communities.map((c) => toCommunityResponse(c, statsMap.get(c.id)))),
      )
      .catch(next);
  });

  // community フィード（新着順・認証不要・#479 で author_worker を付与）
  // eslint-disable-next-line max-params
  router.get("/:slug/feed", (req, res, next) => {
    const { slug } = req.params as { slug: string };
    // sessionId は任意クエリパラメータ。UUID 検証付きで取得し、不正・未指定は null（#831）。
    const sessionId = extractSessionId(req);
    // reveal フィルタ（#556）: createdAt <= now のもののみ公開する。
    const now = new Date();
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return postRepo.listByCommunity(community.id, undefined, { now });
      })
      .then((posts) => attachAuthorWorker(posts, workerRepo))
      // 各 post にコメント件数を付与する（N+1 回避・#500 / reveal フィルタ #875）。
      .then((posts) => attachCommentCount(posts, commentRepo, { now }))
      .then(async (posts) => {
        if (sessionId) {
          const voteMap = await voteRepo.findVotesBySessionAndTargets({
            sessionId,
            targetType: "post",
            targetIds: posts.map((p) => p.id),
          });
          res.status(200).json(posts.map((p) => toPostResponse({ ...p, myVote: voteMap.get(p.id) ?? null })));
        } else {
          // OpenAPI 契約（snake_case）へ整形して返す（#499）。
          res.status(200).json(posts.map(toPostResponse));
        }
      })
      .catch(next);
  });

  // community に最近投稿したワーカー一覧（認証不要・#207）
  // eslint-disable-next-line max-params
  router.get("/:slug/recent-workers", (req, res, next) => {
    const { slug } = req.params as { slug: string };
    // reveal フィルタ（#556）: createdAt <= now の post の author のみ対象にする。
    const recentWorkersNow = new Date();
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return postRepo.listByCommunity(community.id, undefined, { now: recentWorkersNow });
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
  // ユーザー個別データを返すため、未認証時でも公開（共有）キャッシュには載せない（#559 AC3）。
  // ルータ全体の publicCache が未認証 GET に付ける public ヘッダをここで private, no-store に上書きする。
  // eslint-disable-next-line max-params
  router.get("/:slug/subscription", (req, res, next) => {
    res.setHeader("Cache-Control", buildPrivateCacheControl());
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
  // eslint-disable-next-line max-params
  router.post("/:slug/subscribe", requireAuth, (req, res, next) => {
    const { slug } = req.params as { slug: string };
    const userId = getAuthUser(req).id;

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
  // eslint-disable-next-line max-params
  router.delete("/:slug/subscribe", requireAuth, (req, res, next) => {
    const { slug } = req.params as { slug: string };
    const userId = getAuthUser(req).id;

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

  // コミュニティ既読マーク（認証必須・#933）
  // eslint-disable-next-line max-params
  router.patch("/:slug/mark-viewed", requireAuth, (req, res, next) => {
    const { slug } = req.params as { slug: string };
    const userId = getAuthUser(req).id;

    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return subscriptionRepo.hasSubscription(userId, community.id).then((subscribed) => {
          if (!subscribed) {
            return res.status(403).json({ error: "NotSubscribed" });
          }
          return subscriptionRepo
            .updateLastViewedAt({ userId, communityId: community.id, viewedAt: new Date() })
            .then(() => res.status(204).end());
        });
      })
      .catch(next);
  });

  return router;
}
