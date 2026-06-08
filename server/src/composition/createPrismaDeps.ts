import type { PrismaClient } from "@prisma/client";

import type { AppDeps } from "../app.js";
import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { PrismaChannelMembershipRepository } from "../persistence/prismaChannelMembershipRepository.js";
import { PrismaChannelRepository } from "../persistence/prismaChannelRepository.js";
import { PrismaEmployeeRepository } from "../persistence/prismaEmployeeRepository.js";
import { PrismaInvitationLinkRepository } from "../persistence/prismaInvitationLinkRepository.js";
import { PrismaMessageRepository } from "../persistence/prismaMessageRepository.js";
import { PrismaUserRepository } from "../persistence/prismaUserRepository.js";

/**
 * Prisma 実装一式を生成する共有 composition ヘルパ（Issue #137）。
 * server.ts（API プロセス）と batch エントリポイントの両方がこれを使い、
 * リポジトリの二重インスタンス化を解消する。
 *
 * sessionStore と security は呼び出し元（server.ts）が別途設定する。
 * DI コンテナは使わず手動 DI のまま（ADR-0012）。
 * common への DI 基盤の漏洩なし（ADR-0001 / ADR-0005）。
 */
export function createPrismaDeps(
  prisma: PrismaClient,
): Omit<AppDeps, "security" | "sessionStore"> {
  return {
    messageRepository: new PrismaMessageRepository(prisma),
    userRepository: new PrismaUserRepository(prisma),
    channelMembershipRepository: new PrismaChannelMembershipRepository(prisma),
    channelRepository: new PrismaChannelRepository(prisma),
    employeeRepository: new PrismaEmployeeRepository(prisma),
    appSettingRepository: new PrismaAppSettingRepository(prisma),
    batchRunLogRepository: new PrismaBatchRunLogRepository(prisma),
    invitationLinkRepository: new PrismaInvitationLinkRepository(prisma),
  };
}
