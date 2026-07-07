import { pathToFileURL } from "node:url";

import { loadEnv } from "../config/env.js";
import { createClaudeConversationGenerator } from "./aiMessageGenerator.js";
import { logBatchError, logBatchInfo } from "./logger.js";
import {
  runPostBatch,
  DEFAULT_POST_DRIP_WINDOW_MS,
  type RunPostBatchDeps,
  type RunPostBatchResult,
} from "./runPostBatch.js";
import type { PushNotificationService } from "../services/pushNotificationService.js";
import type { SubscriptionRepository } from "../persistence/subscriptionRepository.js";

/** CLI エントリ関数の依存（テスト用注入対応）。 */
export interface PostBatchCliDeps {
  /** runPostBatch に渡す依存一式。 */
  batchDeps: RunPostBatchDeps;
  /** 終了時に必ず呼ぶ後始末（本番では prisma.$disconnect）。 */
  disconnect: () => Promise<void>;
  /** プッシュ通知サービス（#798）。未設定ならプッシュ通知はスキップ。 */
  pushNotificationService?: PushNotificationService;
  /** notify 対象ユーザーの絞り込みに使う（#1088）。未設定ならプッシュ通知はスキップ。 */
  subscriptionRepo?: SubscriptionRepository;
}

/**
 * post 専用バッチのエントリ処理（#672）。
 * runPostBatch を実行して完了ログを出し、成否によらず finally で disconnect する。
 */
export async function runPostBatchCli(cliDeps: PostBatchCliDeps): Promise<RunPostBatchResult> {
  // プッシュ通知の Promise を finally で await し DB 接続クローズ前に完了させる（#798）。
  let pushPromise: Promise<void> | undefined;
  try {
    const result = await runPostBatch(cliDeps.batchDeps);

    logBatchInfo("post_batch.completed", {
      posts: result.posts.length,
    });

    if (cliDeps.pushNotificationService && cliDeps.subscriptionRepo && result.posts.length > 0) {
      const { pushNotificationService, subscriptionRepo } = cliDeps;
      const communityIds = [...new Set(result.posts.map((p) => p.communityId))];
      pushPromise = subscriptionRepo
        .listNotifiableUserIds(communityIds)
        .then((userIds) => {
          if (userIds.length === 0) return;
          return pushNotificationService.sendToUsers(
            { title: "新着投稿", body: "コミュニティに新しい投稿があります", url: "/" },
            userIds,
          );
        })
        .catch((err: unknown) => logBatchError("push_notification.batch_send_failed", err));
    }

    return result;
  } finally {
    await pushPromise;
    await cliDeps.disconnect();
  }
}

/**
 * 直接実行時のエントリ（スケジューラから Express とは別プロセスで起動・ADR-0009）。
 * Cloud Scheduler から 1 日 1 回呼ばれる（ADR-0028 / ADR-0034）。
 */
async function main(): Promise<void> {
  const env = loadEnv();

  const [
    { prisma },
    { createPrismaBatchRunLogRepository },
    { createPrismaCommunityRepository },
    { createPrismaPostRepository },
    { createPrismaCommentRepository },
    { createPrismaWorkerCommunityRepository },
    { createPrismaWorkerRepository },
    { createPrismaWorldStateRepository },
    { createPrismaTokenUsageLogRepository },
    { createPrismaPushSubscriptionRepository },
    { createPushNotificationService },
    { createPrismaSubscriptionRepository },
  ] = await Promise.all([
    import("../persistence/prismaClient.js"),
    import("../persistence/prismaBatchRunLogRepository.js"),
    import("../persistence/prismaCommunityRepository.js"),
    import("../persistence/prismaPostRepository.js"),
    import("../persistence/prismaCommentRepository.js"),
    import("../persistence/prismaWorkerCommunityRepository.js"),
    import("../persistence/prismaWorkerRepository.js"),
    import("../persistence/prismaWorldStateRepository.js"),
    import("../persistence/prismaTokenUsageLogRepository.js"),
    import("../persistence/prismaPushSubscriptionRepository.js"),
    import("../services/pushNotificationService.js"),
    import("../persistence/prismaSubscriptionRepository.js"),
  ]);

  const workerRepo = createPrismaWorkerRepository(prisma);

  const pushNotificationService =
    env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject
      ? createPushNotificationService({
          config: {
            publicKey: env.vapidPublicKey,
            privateKey: env.vapidPrivateKey,
            subject: env.vapidSubject,
          },
          pushSubscriptionRepo: createPrismaPushSubscriptionRepository(prisma),
        })
      : undefined;

  await runPostBatchCli({
    batchDeps: {
      communityRepo: createPrismaCommunityRepository(prisma),
      postRepo: createPrismaPostRepository(prisma),
      commentRepo: createPrismaCommentRepository(prisma),
      batchRunLogRepository: createPrismaBatchRunLogRepository(prisma),
      workerCommunityRepo: createPrismaWorkerCommunityRepository(prisma),
      botWorkerProvider: () => workerRepo.listBotWorkers(),
      worldStateRepository: createPrismaWorldStateRepository(prisma),
      anthropicApiKey: env.anthropicApiKey,
      generate: createClaudeConversationGenerator(env.batchModel),
      recentLimit: env.batchRecentLimit,
      dripWindowMs: DEFAULT_POST_DRIP_WINDOW_MS,
      tokenUsageLogRepository: createPrismaTokenUsageLogRepository(prisma),
    },
    disconnect: () => prisma.$disconnect(),
    pushNotificationService,
    subscriptionRepo: createPrismaSubscriptionRepository(prisma),
  });
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err: unknown) => {
    logBatchError("post_batch.cli_failed", err);
    process.exitCode = 1;
  });
}
