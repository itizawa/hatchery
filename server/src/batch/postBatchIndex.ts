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

/** CLI エントリ関数の依存（テスト用注入対応）。 */
export interface PostBatchCliDeps {
  /** runPostBatch に渡す依存一式。 */
  batchDeps: RunPostBatchDeps;
  /** 終了時に必ず呼ぶ後始末（本番では prisma.$disconnect）。 */
  disconnect: () => Promise<void>;
}

/**
 * post 専用バッチのエントリ処理（#672）。
 * runPostBatch を実行して完了ログを出し、成否によらず finally で disconnect する。
 */
export async function runPostBatchCli(cliDeps: PostBatchCliDeps): Promise<RunPostBatchResult> {
  try {
    const result = await runPostBatch(cliDeps.batchDeps);

    logBatchInfo("post_batch.completed", {
      posts: result.posts.length,
    });

    return result;
  } finally {
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
  ]);

  const workerRepo = createPrismaWorkerRepository(prisma);

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
