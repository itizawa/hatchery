import type { AppDeps } from "../app.js";
import { InMemoryAppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryBatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryInvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryTokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";

/**
 * テスト用の依存注入オーバーライド。
 * 各フィールドを省略すると InMemory 実装のデフォルトが使われる。
 */
export type TestDepsOverrides = Partial<AppDeps>;

/**
 * テスト用合成ヘルパ（Issue #137）。
 * createApp に渡す全依存を InMemory 実装で束ねて返す。
 * overrides で任意のリポジトリを上書きできる（個別 spy・カスタムデータ注入に使う）。
 *
 * デフォルトの userRepository は InMemoryUserRepository.createWithTestUser() で
 * testuser / testpass のテストユーザーを含む。
 */
export async function createTestDeps(overrides?: TestDepsOverrides): Promise<AppDeps> {
  // overrides に userRepository が指定されている場合は bcrypt 計算をスキップする（効率化）。
  const defaultUserRepo =
    overrides?.userRepository ?? (await InMemoryUserRepository.createWithTestUser());
  return {
    messageRepository: new InMemoryMessageRepository(),
    userRepository: defaultUserRepo,
    channelMembershipRepository: new InMemoryChannelMembershipRepository(),
    channelRepository: new InMemoryChannelRepository(),
    employeeRepository: new InMemoryEmployeeRepository(),
    appSettingRepository: new InMemoryAppSettingRepository(),
    batchRunLogRepository: new InMemoryBatchRunLogRepository(),
    invitationLinkRepository: new InMemoryInvitationLinkRepository(),
    tokenUsageLogRepository: new InMemoryTokenUsageLogRepository(),
    ...overrides,
  };
}
