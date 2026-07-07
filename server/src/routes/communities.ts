import {
  CommunityFeedQuerySchema,
  CommunityWorkersQuerySchema,
  NotFoundError,
  UpdateSubscriptionNotifyEnabledBodySchema,
} from "@hatchery/common";
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
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { attachAuthorWorker } from "./authorWorker.js";
import { attachCommentCount } from "./commentCount.js";
import { extractSessionId } from "./extractSessionId.js";
import { toPostResponse } from "./postResponse.js";

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
  workerCommunityRepo: WorkerCommunityRepository,
): Router {
  const router = Router();

  // community 一覧（認証不要・公共コミュニティ）
  // CommunityRecord（camelCase）を OpenAPI 契約（snake_case created_at）に整形して返す（#477）
  // post_count / last_post_at を活気指標として付与する（N+1 回避・#527）
  // subscriber_count を社会的証明として付与する（N+1 回避・#930）
  // eslint-disable-next-line max-params
  router.get("/", (_req, res, next) => {
    Promise.all([
      communityRepo.list(),
      postRepo.getStatsByCommunity(),
      subscriptionRepo.subscriberCountPerCommunity(),
    ])
      .then(([communities, statsMap, subscriberMap]) =>
        res.status(200).json(
          communities.map((c) =>
            toCommunityResponse(c, statsMap.get(c.id), subscriberMap.get(c.id) ?? 0),
          ),
        ),
      )
      .catch(next);
  });

  // community フィード（新着順・認証不要・#479 で author_worker を付与・#881 ページネーション対応）
  // eslint-disable-next-line max-params
  router.get("/:slug/feed", (req, res, next) => {
    const parsed = CommunityFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { cursor, limit, sort } = parsed.data;
    const { slug } = req.params as { slug: string };
    const sessionId = extractSessionId(req);
    const now = new Date();
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        const fetchPage =
          sort === "popular"
            ? postRepo.listByCommunityPopularPaged({ communityId: community.id, cursor, limit, options: { now } })
            : postRepo.listByCommunityPaged({ communityId: community.id, cursor, limit, options: { now } });
        return fetchPage;
      })
      .then(async (result) => {
        const enriched = await attachAuthorWorker(result.posts, workerRepo);
        const withCounts = await attachCommentCount(enriched, commentRepo, { now });
        if (sessionId) {
          const voteMap = await voteRepo.findVotesBySessionAndTargets({
            sessionId,
            targetType: "post",
            targetIds: withCounts.map((p) => p.id),
          });
          const posts = withCounts.map((p) => toPostResponse({ ...p, myVote: voteMap.get(p.id) ?? null }));
          res.status(200).json({ ...result, posts });
        } else {
          const posts = withCounts.map(toPostResponse);
          res.status(200).json({ ...result, posts });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "INVALID_CURSOR") {
          res.status(400).json({ error: "ValidationError", issues: [{ message: "カーソルが不正です" }] });
          return;
        }
        next(err);
      });
  });

  // community 所属の全ワーカー一覧（認証不要・カーソルページネーション・#1078）
  // eslint-disable-next-line max-params
  router.get("/:slug/workers", (req, res, next) => {
    const parsed = CommunityWorkersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { cursor, limit } = parsed.data;
    const { slug } = req.params as { slug: string };
    communityRepo
      .findBySlug(slug)
      .then((community) => {
        if (!community) {
          throw new NotFoundError("CommunityNotFound");
        }
        return workerCommunityRepo.listWorkersByCommunity({ communityId: community.id, cursor, limit });
      })
      .then((result) => res.status(200).json({ items: result.items, nextCursor: result.nextCursor }))
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "INVALID_CURSOR") {
          res.status(400).json({ error: "ValidationError", issues: [{ message: "カーソルが不正です" }] });
          return;
        }
        next(err);
      });
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
          return res.status(200).json({ subscribed: false, notify_enabled: true });
        }
        return subscriptionRepo
          .find({ userId: req.user.id, communityId: community.id })
          .then((record) =>
            res.status(200).json({ subscribed: record !== null, notify_enabled: record?.notifyEnabled ?? true }),
          );
      })
      .catch(next);
  });

  // community 単位の通知 ON/OFF 更新（認証必須・購読済みのみ・#1088）
  // eslint-disable-next-line max-params
  router.patch("/:slug/subscription", requireAuth, (req, res, next) => {
    const parsed = UpdateSubscriptionNotifyEnabledBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
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
            .updateNotifyEnabled({ userId, communityId: community.id, notifyEnabled: parsed.data.notify_enabled })
            .then(() => res.status(204).end());
        });
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
