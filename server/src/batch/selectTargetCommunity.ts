import { type CommunityWeight, buildCommunityWeights, selectWeightedCommunity } from "@hatchery/common";

import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";

/** vote 重みの集計対象期間（日数）。 */
export const VOTE_WEIGHT_WINDOW_DAYS = 7;

/**
 * vote 重み付きランダムで 1 コミュニティを選ぶ（#486 / ADR-0030）。
 *
 * @returns 選ばれた CommunityRecord。community が 0 件のときは null。
 */
export async function selectOneCommunity({
  communities,
  voteRepo,
  rng,
  now,
}: {
  communities: readonly CommunityRecord[];
  voteRepo: VoteRepository;
  rng: () => number;
  now: Date;
}): Promise<CommunityRecord | null> {
  if (communities.length === 0) return null;

  const since = new Date(now.getTime() - VOTE_WEIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const netScores = await voteRepo.netScoresByCommunitySince(since);

  const weights: CommunityWeight[] = buildCommunityWeights(
    communities.map((c) => c.id),
    netScores,
  );

  const selectedId = selectWeightedCommunity(weights, rng);
  if (selectedId === null) return null;
  return communities.find((c) => c.id === selectedId) ?? null;
}
