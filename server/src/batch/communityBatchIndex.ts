import { pathToFileURL } from "node:url";

import { loadEnv } from "../config/env.js";
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

    console.log(
      `[communityBatch] 完了: ${result.posts.length} posts, ${result.comments.length} comments created`,
    );

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
    { createPrismaAppSettingRepository },
    { createPrismaBatchRunLogRepository },
    { createPrismaCommunityRepository },
    { createPrismaPostRepository },
    { createPrismaCommentRepository },
    { createPrismaVoteRepository },
    { createPrismaWorkerCommunityRepository },
    { createPrismaWorkerRepository },
  ] = await Promise.all([
    import("../persistence/prismaClient.js"),
    import("../persistence/prismaAppSettingRepository.js"),
    import("../persistence/prismaBatchRunLogRepository.js"),
    import("../persistence/prismaCommunityRepository.js"),
    import("../persistence/prismaPostRepository.js"),
    import("../persistence/prismaCommentRepository.js"),
    import("../persistence/prismaVoteRepository.js"),
    import("../persistence/prismaWorkerCommunityRepository.js"),
    import("../persistence/prismaWorkerRepository.js"),
  ]);

  const workerRepo = createPrismaWorkerRepository(prisma);

  await runCommunityBatchCli({
    batchDeps: {
      communityRepo: createPrismaCommunityRepository(prisma),
      postRepo: createPrismaPostRepository(prisma),
      commentRepo: createPrismaCommentRepository(prisma),
      appSettingRepo: createPrismaAppSettingRepository(prisma),
      batchRunLogRepository: createPrismaBatchRunLogRepository(prisma),
      // vote 重み付き 1 コミュニティ選定の重み算出に使う（#486 / ADR-0030）。
      voteRepo: createPrismaVoteRepository(prisma),
      // community 別の登場ワーカーを DB から解決する（#489）。
      workerCommunityRepo: createPrismaWorkerCommunityRepository(prisma),
      // 紐づき 0 件 community のフォールバック先（全 Bot ワーカー）。
      botWorkerProvider: () => workerRepo.listBotWorkers(),
      anthropicApiKey: env.anthropicApiKey,
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
    console.error("[communityBatch] エラー:", err);
    process.exitCode = 1;
  });
}
