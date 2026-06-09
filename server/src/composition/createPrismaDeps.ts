import type { PrismaClient } from "@prisma/client";

import type { AppDeps } from "../app.js";
import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { PrismaEmployeeRepository } from "../persistence/prismaEmployeeRepository.js";
import { PrismaInvitationLinkRepository } from "../persistence/prismaInvitationLinkRepository.js";
import { PrismaTokenUsageLogRepository } from "../persistence/prismaTokenUsageLogRepository.js";
import { PrismaUserRepository } from "../persistence/prismaUserRepository.js";
import { GcsStorageService, InMemoryStorageService } from "../services/storageService.js";
import { PrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { PrismaPostRepository } from "../persistence/prismaPostRepository.js";
import { PrismaCommentRepository } from "../persistence/prismaCommentRepository.js";
import { PrismaSubscriptionRepository } from "../persistence/prismaSubscriptionRepository.js";
import { PrismaVoteRepository } from "../persistence/prismaVoteRepository.js";
import { PrismaWorldStateRepository } from "../persistence/prismaWorldStateRepository.js";
import { InMemoryChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

/**
 * Prisma 実装一式を生成する共有 composition ヘルパ（Issue #137）。
 * server.ts（API プロセス）と batch エントリポイントの両方がこれを使い、
 * リポジトリの二重インスタンス化を解消する。
 *
 * sessionStore と security は呼び出し元（server.ts）が別途設定する。
 * DI コンテナは使わず手動 DI のまま（ADR-0012）。
 * common への DI 基盤の漏洩なし（ADR-0001 / ADR-0005）。
 *
 * #305: Message / Channel 系の Prisma 実装は旧スキーマ削除に伴い廃止。
 * 旧 API ルート（/api/channels, /api/messages）は app.ts から外しているため、
 * InMemory 実装でダミーを渡す（将来的には AppDeps から削除予定）。
 */
export function createPrismaDeps(
  prisma: PrismaClient,
): Omit<AppDeps, "security" | "sessionStore"> {
  // GCS_BUCKET_NAME が設定されていれば GCS、未設定（ローカル開発）は InMemory を使う（ADR-0022）。
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  const storageService = gcsBucketName
    ? new GcsStorageService(gcsBucketName)
    : new InMemoryStorageService();

  return {
    // 旧モデル（Message / Channel / ChannelEmployee）は #305 でスキーマ削除済み。
    // app.ts から旧 routes を外しているため InMemory ダミーを使う。
    messageRepository: new InMemoryMessageRepository(),
    channelMembershipRepository: new InMemoryChannelMembershipRepository(),
    channelRepository: new InMemoryChannelRepository(),
    // 継続するリポジトリ
    userRepository: new PrismaUserRepository(prisma),
    employeeRepository: new PrismaEmployeeRepository(prisma),
    appSettingRepository: new PrismaAppSettingRepository(prisma),
    batchRunLogRepository: new PrismaBatchRunLogRepository(prisma),
    invitationLinkRepository: new PrismaInvitationLinkRepository(prisma),
    tokenUsageLogRepository: new PrismaTokenUsageLogRepository(prisma),
    storageService,
    // 公共コミュニティ（#305 / ADR-0019）
    communityRepository: new PrismaCommunityRepository(prisma),
    postRepository: new PrismaPostRepository(prisma),
    commentRepository: new PrismaCommentRepository(prisma),
    subscriptionRepository: new PrismaSubscriptionRepository(prisma),
    voteRepository: new PrismaVoteRepository(prisma),
    worldStateRepository: new PrismaWorldStateRepository(prisma),
  };
}
