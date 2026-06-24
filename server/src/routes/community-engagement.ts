import { Router } from "express";
import {
  CommunityEngagementSchema,
  computeLoyaltyScore,
  computeVoteShares,
} from "@hatchery/common";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";

/** 集計ウィンドウ（日数）。ADR-0030 の VOTE_WEIGHT_WINDOW_DAYS に偃い名前付き定数で切り出す（#761）。 */
export const ENGAGEMENT_WINDOW_DAYS = 30;

export function createCommunityEngagementRouter({
  voteRepository,
  subscriptionRepository,
}: {
  voteRepository: VoteRepository;
  subscriptionRepository: SubscriptionRepository;
}): Router {
  const router = Router();

  // GET /api/admin/community-engagement は admin ロール必須（requireAuth → requireAdmin の順）。
  // eslint-disable-next-line max-params
  router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const since = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const [communityCounts, workerCounts, userVotesByCommunity, subscriberCounts] =
        await Promise.all([
          voteRepository.netScoresByCommunitySince(since),
          voteRepository.netScoresByWorkerSince(since),
          voteRepository.voteCountsPerUserPerCommunitySince(since),
          subscriptionRepository.subscriberCountPerCommunity(),
        ]);

      // コミュニティ別・ワーカー別 vote シェアを計算する（純粋ロジック in common）
      const communityVoteShares = computeVoteShares({ counts: communityCounts });
      const workerVoteShares = computeVoteShares({ counts: workerCounts });

      // 独占的ロイヤリティスコアを計算する（純粋ロジック in common）
      const loyaltyScore = computeLoyaltyScore({ userVotesByCommunity });

      // subscriberCounts を Record<string, number> に変換
      const subscriberCountByCommunity: Record<string, number> = {};
      for (const [communityId, count] of subscriberCounts) {
        subscriberCountByCommunity[communityId] = count;
      }

      const payload = CommunityEngagementSchema.parse({
        windowDays: ENGAGEMENT_WINDOW_DAYS,
        communityVotes: communityVoteShares.map((e) => ({
          communityId: e.id,
          count: e.count,
          sharePercent: e.sharePercent,
        })),
        workerVotes: workerVoteShares.map((e) => ({
          workerId: e.id,
          count: e.count,
          sharePercent: e.sharePercent,
        })),
        loyaltyScore,
        subscriberCountByCommunity,
      });

      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
