import type { AppDeps } from "../app.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryPushSubscriptionRepository } from "../persistence/inMemoryPushSubscriptionRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createInMemoryViewRepository } from "../persistence/viewRepository.js";
import { buildResolveTrendingTargetMeta, createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorldStateRepository } from "../persistence/worldStateRepository.js";
import { InMemoryStorageService } from "../services/storageService.js";

// #455: 招待制廃止により invitationLinkRepository を削除。
export type TestDepsOverrides = Partial<AppDeps>;

export function createTestDeps(overrides?: TestDepsOverrides): AppDeps {
  const defaultUserRepo = overrides?.userRepository ?? createTestUserRepository();
  // #1065: voteRepository.trendingItemsSince が overrides のリポジトリと矛盾しないよう、
  // trendingItemsSince の解決に使う postRepository/commentRepository/communityRepository は
  // overrides を反映した最終的なものを先に確定させてから voteRepository に渡す。
  const communityRepository = overrides?.communityRepository ?? createInMemoryCommunityRepository();
  const postRepository = overrides?.postRepository ?? createInMemoryPostRepository();
  const commentRepository = overrides?.commentRepository ?? createInMemoryCommentRepository();
  return {
    userRepository: defaultUserRepo,
    workerRepository: createInMemoryWorkerRepository(),
    workerCommunityRepository: createInMemoryWorkerCommunityRepository(),
    batchRunLogRepository: createInMemoryBatchRunLogRepository(),
    tokenUsageLogRepository: createInMemoryTokenUsageLogRepository(),
    communityRepository,
    postRepository,
    commentRepository,
    subscriptionRepository: createInMemorySubscriptionRepository(),
    viewRepository: createInMemoryViewRepository(),
    voteRepository: createInMemoryVoteRepository({
      resolveTrendingTargetMeta: buildResolveTrendingTargetMeta({
        postRepository,
        commentRepository,
        communityRepository,
      }),
    }),
    worldStateRepository: createInMemoryWorldStateRepository(),
    storageService: new InMemoryStorageService(),
    pushSubscriptionRepository: createInMemoryPushSubscriptionRepository(),
    ...overrides,
  };
}
