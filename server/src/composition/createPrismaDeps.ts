import type { PrismaClient } from "@prisma/client";

import type { AppDeps } from "../app.js";
import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { PrismaWorkerRepository } from "../persistence/prismaWorkerRepository.js";
import { PrismaInvitationLinkRepository } from "../persistence/prismaInvitationLinkRepository.js";
import { PrismaTokenUsageLogRepository } from "../persistence/prismaTokenUsageLogRepository.js";
import { PrismaUserRepository } from "../persistence/prismaUserRepository.js";
import { PrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { PrismaPostRepository } from "../persistence/prismaPostRepository.js";
import { PrismaCommentRepository } from "../persistence/prismaCommentRepository.js";
import { PrismaSubscriptionRepository } from "../persistence/prismaSubscriptionRepository.js";
import { PrismaVoteRepository } from "../persistence/prismaVoteRepository.js";
import { PrismaWorldStateRepository } from "../persistence/prismaWorldStateRepository.js";
import { GcsStorageService, InMemoryStorageService } from "../services/storageService.js";

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
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  const storageService = gcsBucketName
    ? new GcsStorageService(gcsBucketName)
    : new InMemoryStorageService();

  return {
    userRepository: new PrismaUserRepository(prisma),
    workerRepository: new PrismaWorkerRepository(prisma),
    appSettingRepository: new PrismaAppSettingRepository(prisma),
    batchRunLogRepository: new PrismaBatchRunLogRepository(prisma),
    invitationLinkRepository: new PrismaInvitationLinkRepository(prisma),
    tokenUsageLogRepository: new PrismaTokenUsageLogRepository(prisma),
    communityRepository: new PrismaCommunityRepository(prisma),
    postRepository: new PrismaPostRepository(prisma),
    commentRepository: new PrismaCommentRepository(prisma),
    subscriptionRepository: new PrismaSubscriptionRepository(prisma),
    voteRepository: new PrismaVoteRepository(prisma),
    worldStateRepository: new PrismaWorldStateRepository(prisma),
    storageService,
  };
}
