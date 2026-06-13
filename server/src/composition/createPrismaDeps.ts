import type { PrismaClient } from "@prisma/client";

import type { AppDeps } from "../app.js";
import { createPrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { createPrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { createPrismaWorkerRepository } from "../persistence/prismaWorkerRepository.js";
import { createPrismaWorkerCommunityRepository } from "../persistence/prismaWorkerCommunityRepository.js";
import { createPrismaTokenUsageLogRepository } from "../persistence/prismaTokenUsageLogRepository.js";
import { createPrismaUserRepository } from "../persistence/prismaUserRepository.js";
import { createPrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { createPrismaPostRepository } from "../persistence/prismaPostRepository.js";
import { createPrismaCommentRepository } from "../persistence/prismaCommentRepository.js";
import { createPrismaSubscriptionRepository } from "../persistence/prismaSubscriptionRepository.js";
import { createPrismaVoteRepository } from "../persistence/prismaVoteRepository.js";
import { createPrismaWorldStateRepository } from "../persistence/prismaWorldStateRepository.js";
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
export function createPrismaDeps(prisma: PrismaClient, gcsBucketName?: string): Omit<AppDeps, "security" | "sessionStore"> {
  const storageService = gcsBucketName
    ? new GcsStorageService(gcsBucketName)
    : new InMemoryStorageService();

  return {
    userRepository: createPrismaUserRepository(prisma),
    workerRepository: createPrismaWorkerRepository(prisma),
    workerCommunityRepository: createPrismaWorkerCommunityRepository(prisma),
    appSettingRepository: createPrismaAppSettingRepository(prisma),
    batchRunLogRepository: createPrismaBatchRunLogRepository(prisma),
    tokenUsageLogRepository: createPrismaTokenUsageLogRepository(prisma),
    communityRepository: createPrismaCommunityRepository(prisma),
    postRepository: createPrismaPostRepository(prisma),
    commentRepository: createPrismaCommentRepository(prisma),
    subscriptionRepository: createPrismaSubscriptionRepository(prisma),
    voteRepository: createPrismaVoteRepository(prisma),
    worldStateRepository: createPrismaWorldStateRepository(prisma),
    storageService,
  };
}
