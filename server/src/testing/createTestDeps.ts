import type { AppDeps } from "../app.js";
import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorldStateRepository } from "../persistence/worldStateRepository.js";
import { InMemoryStorageService } from "../services/storageService.js";

// #455: 招待制廃止により invitationLinkRepository を削除。
export type TestDepsOverrides = Partial<AppDeps>;

export function createTestDeps(overrides?: TestDepsOverrides): AppDeps {
  const defaultUserRepo = overrides?.userRepository ?? createTestUserRepository();
  return {
    userRepository: defaultUserRepo,
    workerRepository: createInMemoryWorkerRepository(),
    appSettingRepository: createInMemoryAppSettingRepository(),
    batchRunLogRepository: createInMemoryBatchRunLogRepository(),
    tokenUsageLogRepository: createInMemoryTokenUsageLogRepository(),
    communityRepository: createInMemoryCommunityRepository(),
    postRepository: createInMemoryPostRepository(),
    commentRepository: createInMemoryCommentRepository(),
    subscriptionRepository: createInMemorySubscriptionRepository(),
    voteRepository: createInMemoryVoteRepository(),
    worldStateRepository: createInMemoryWorldStateRepository(),
    storageService: new InMemoryStorageService(),
    ...overrides,
  };
}
