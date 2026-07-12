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
    // community/post/subscription の総数と累計閲覧数は、内訳集計のために取得済みの
    // Map・community 一覧から導出できる（post/comment/subscription は必ず community に紐づくため
    // 内訳の総和 = 全体数になる）。同じ値を得るための重複クエリ（count() / totalViewCount()）は発行しない。
    Promise.all([
      communityRepository.list(),
      workerRepository.count(),
      postRepository.getStatsByCommunity(),
      commentRepository.count(),
      voteRepository.count(),
      subscriptionRepository.subscriberCountPerCommunity(),
      viewRepository.viewCountByCommunity(),
    ])
      .then(
        ([
          communities,
          workerCount,
          postStatsByCommunity,
          commentCount,
          voteCount,
          subscriberCounts,
          viewCountsByCommunity,
        ]) => {
          const sum = (values: Iterable<number>): number => {
            let total = 0;
            for (const value of values) total += value;
            return total;
          };

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
            community_count: communities.length,
            worker_count: workerCount,
            post_count: sum(Array.from(postStatsByCommunity.values(), (s) => s.postCount)),
            comment_count: commentCount,
            total_view_count: sum(viewCountsByCommunity.values()),
            total_vote_count: voteCount,
            total_subscription_count: sum(subscriberCounts.values()),
            communities: breakdown,
          });

          res.status(200).json(payload);
        },
      )
      .catch(next);
  });

  return router;
}
