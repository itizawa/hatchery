import { prisma } from "../persistence/prismaClient.js";
import { createPrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { createPrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { createPrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { createPrismaPostRepository } from "../persistence/prismaPostRepository.js";
import { createPrismaCommentRepository } from "../persistence/prismaCommentRepository.js";

import { runCommunityBatch } from "./runCommunityBatch.js";

/**
 * community 単位の定時バッチ CLI エントリ（#306）。
 * スケジューラから Express とは別プロセスで起動する（ADR-0009）。
 * 全 community に対して 1 コミュニティ = 1 API コールで Post + Comment を生成・永続化する。
 */
async function main(): Promise<void> {
  const communityRepo = createPrismaCommunityRepository(prisma);
  const postRepo = createPrismaPostRepository(prisma);
  const commentRepo = createPrismaCommentRepository(prisma);
  const appSettingRepo = createPrismaAppSettingRepository(prisma);
  const batchRunLogRepository = createPrismaBatchRunLogRepository(prisma);

  try {
    const result = await runCommunityBatch({
      communityRepo,
      postRepo,
      commentRepo,
      appSettingRepo,
      batchRunLogRepository,
    });

    console.log(
      `[communityBatch] 完了: ${result.posts.length} posts, ${result.comments.length} comments created`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[communityBatch] エラー:", err);
  process.exitCode = 1;
});
