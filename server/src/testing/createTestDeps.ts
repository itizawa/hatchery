import type { AppDeps } from "../app.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { InMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { InMemoryInvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { InMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { InMemoryStorageService } from "../services/storageService.js";

/** テスト用の依存注入オーバーライド。各フィールドを省略すると InMemory 実装のデフォルトが使われる。 */
export type TestDepsOverrides = Partial<AppDeps>;

/**
 * テスト用合成ヘルパ（Issue #137）。
 * createApp に渡す全依存を InMemory 実装で束ねて返す。
 * overrides で任意のリポジトリを上書きできる。
 */
export async function createTestDeps(overrides?: TestDepsOverrides): Promise<AppDeps> {
  const defaultUserRepo =
    overrides?.userRepository ?? (await InMemoryUserRepository.createWithTestUser());
  return {
    userRepository: defaultUserRepo,
    workerRepository: new InMemoryWorkerRepository(),
    appSettingRepository: new InMemoryAppSettingRepository(),
    batchRunLogRepository: new InMemoryBatchRunLogRepository(),
    invitationLinkRepository: new InMemoryInvitationLinkRepository(),
    tokenUsageLogRepository: new InMemoryTokenUsageLogRepository(),
    communityRepository: new InMemoryCommunityRepository(),
    storageService: new InMemoryStorageService(),
    ...overrides,
  };
}
