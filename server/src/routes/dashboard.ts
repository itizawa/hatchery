import { DashboardSummarySchema } from "@hatchery/common";
import { Router } from "express";

import type { CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";
import type { ViewRepository } from "../persistence/viewRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";

/**
 * サイト全体の定量サマリダッシュボード（認証不要・#1113）。
 * コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・購読数の
 * サイト全体サマリと、コミュニティ別内訳（view_count 降順）を返す。
 * 個人に紐づかない集計値のため `requireAuth` / `requireAdmin` は挟まない
 * （`workers.ts` の `/ranking` と同じ公開 route の作法）。
 */
export function createDashboardRouter({
  communityRepository,
  workerRepository,
  postRepository,
  commentRepository,
  voteRepository,
  subscriptionRepository,
  viewRepository,
}: {
  communityRepository: CommunityRepository;
  workerRepository: WorkerRepository;
  postRepository: PostRepository;
  commentRepository: CommentRepository;
  voteRepository: VoteRepository;
  subscriptionRepository: SubscriptionRepository;
  viewRepository: ViewRepository;
}): Router {
  const router = Router();

  // eslint-disable-next-line max-params
  router.get("/", (_req, res, next) => {
    Promise.all([
      communityRepository.list(),
      communityRepository.count(),
      workerRepository.count(),
      postRepository.count(),
      postRepository.getStatsByCommunity(),
      commentRepository.count(),
      voteRepository.count(),
      subscriptionRepository.count(),
      subscriptionRepository.subscriberCountPerCommunity(),
      viewRepository.totalViewCount(),
      viewRepository.viewCountByCommunity(),
    ])
      .then(
        ([
          communities,
          communityCount,
          workerCount,
          postCount,
          postStatsByCommunity,
          commentCount,
          voteCount,
          subscriptionCount,
          subscriberCounts,
          totalViewCount,
          viewCountsByCommunity,
        ]) => {
          const breakdown = communities
            .map((c) => ({
              community_id: c.id,
              slug: c.slug,
              name: c.name,
              post_count: postStatsByCommunity.get(c.id)?.postCount ?? 0,
              subscriber_count: subscriberCounts.get(c.id) ?? 0,
              view_count: viewCountsByCommunity.get(c.id) ?? 0,
            }))
            // eslint-disable-next-line max-params
            .sort((a, b) => b.view_count - a.view_count);

          const payload = DashboardSummarySchema.parse({
            community_count: communityCount,
            worker_count: workerCount,
            post_count: postCount,
            comment_count: commentCount,
            total_view_count: totalViewCount,
            total_vote_count: voteCount,
            total_subscription_count: subscriptionCount,
            communities: breakdown,
          });

          res.status(200).json(payload);
        },
      )
      .catch(next);
  });

  return router;
}
