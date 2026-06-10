import type { AppDeps } from "../app.js";
import { createInMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { createInMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryInvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorldStateRepository } from "../persistence/worldStateRepository.js";
import { InMemoryStorageService } from "../services/storageService.js";

/** テスト用の依存注入オーバーライド。各フィールドを省略すると InMemory 実装のデフォルトが使われる。 */
export type TestDepsOverrides = Partial<AppDeps>;

/**
 * テスト用合成ヘルパ（Issue #137）。
 * createApp に渡す全依存を InMemory 実装で束ねて返す。
 * overrides で任意のリポジトリを上書きできる。
 */
export async function createTestDeps(overrides?: TestDepsOverrides): Promise<AppDeps> {
  const defaultUserRepo = overrides?.userRepository ?? (await createTestUserRepository());
  return {
    userRepository: defaultUserRepo,
    workerRepository: createInMemoryWorkerRepository(),
    appSettingRepository: createInMemoryAppSettingRepository(),
    batchRunLogRepository: createInMemoryBatchRunLogRepository(),
    invitationLinkRepository: createInMemoryInvitationLinkRepository(),
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
