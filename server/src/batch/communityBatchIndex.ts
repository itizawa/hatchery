/**
 * @deprecated #673 完了後は postBatchIndex + commentBatchIndex に移行。Cloud Scheduler から外した後にコードを削除する（ADR-0034）。
 */
import { pathToFileURL } from "node:url";

import { loadEnv } from "../config/env.js";
import { createClaudeConversationGenerator } from "./aiMessageGenerator.js";
import { logBatchError, logBatchInfo } from "./logger.js";
import {
  runCommunityBatch,
  type RunCommunityBatchDeps,
  type RunCommunityBatchResult,
} from "./runCommunityBatch.js";

/** CLI エントリ関数の依存（テスト用注入対応・#383）。 */
export interface CommunityBatchCliDeps {
  /** runCommunityBatch に渡す依存一式。 */
  batchDeps: RunCommunityBatchDeps;
  /** 終了時に必ず呼ぶ後始末（本番では prisma.$disconnect）。 */
  disconnect: () => Promise<void>;
}

/**
 * community 単位の定時バッチのエントリ処理（#306 / #383）。
 * runCommunityBatch を実行して完了ログを出し、成否によらず finally で disconnect する。
 * バッチ本体の throw はそのまま伝播させる（直接実行時は main().catch で exitCode=1 を設定）。
 */
export async function runCommunityBatchCli(
  cliDeps: CommunityBatchCliDeps,
): Promise<RunCommunityBatchResult> {
  try {
    const result = await runCommunityBatch(cliDeps.batchDeps);

    logBatchInfo("community_batch.completed", {
      posts: result.posts.length,
      comments: result.comments.length,
    });

    return result;
  } finally {
    await cliDeps.disconnect();
  }
}

/**
 * 直接実行時のエントリ（スケジューラから Express とは別プロセスで起動・ADR-0009）。
 * prismaClient（new PrismaClient()）と Prisma リポジトリ群（一部 @prisma/client を
 * 値 import する）は、テストからの import で @prisma/client がロードされないよう
 * ここで動的 import する（prisma generate 前の環境でもテストが動くようにするため）。
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

  await runCommunityBatchCli({
    batchDeps: {
      communityRepo: createPrismaCommunityRepository(prisma),
      postRepo: createPrismaPostRepository(prisma),
      commentRepo: createPrismaCommentRepository(prisma),
      batchRunLogRepository: createPrismaBatchRunLogRepository(prisma),
      // community 別の登場ワーカーを DB から解決する（#489）。
      workerCommunityRepo: createPrismaWorkerCommunityRepository(prisma),
      // 紐づき 0 件 community のフォールバック先（全 Bot ワーカー）。
      botWorkerProvider: () => workerRepo.listBotWorkers(),
      // 登場ローテーション（#464）: lastAppearedSlotKey の読み書きで登場ワーカーを公平化する。
      worldStateRepository: createPrismaWorldStateRepository(prisma),
      anthropicApiKey: env.anthropicApiKey,
      // モデル選定の設定化（#389 AC1）: env.batchModel から生成関数を作って注入する。
      generate: createClaudeConversationGenerator(env.batchModel),
      // 直近ログ件数の設定化（#389 AC2）: env.batchRecentLimit を recentLimit に反映する。
      recentLimit: env.batchRecentLimit,
      // post/comment 件数の揺らぎ設定（#557）: env の範囲を postRange/commentRange に反映する。
      postRange: { min: env.batchPostMin, max: env.batchPostMax },
      commentRange: { min: env.batchCommentMin, max: env.batchCommentMax },
      // ドリップ窓の設定化（#556）: env.batchDripWindowMs を dripWindowMs に反映する。
      dripWindowMs: env.batchDripWindowMs,
      // トークン使用量の記録（#663）: generate() 成功後に TokenUsageLog を保存する。
      tokenUsageLogRepository: createPrismaTokenUsageLogRepository(prisma),
    },
    disconnect: () => prisma.$disconnect(),
  });
}

// 直接実行（tsx src/batch/communityBatchIndex.ts）のときだけ main を起動する。
// テストからの import ではバッチを実行しない（#383）。
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err: unknown) => {
    logBatchError("community_batch.cli_failed", err);
    process.exitCode = 1;
  });
}
