import { prisma } from "../persistence/prismaClient.js";
import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { PrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { PrismaPostRepository } from "../persistence/prismaPostRepository.js";
import { PrismaCommentRepository } from "../persistence/prismaCommentRepository.js";

import { runCommunityBatch } from "./runCommunityBatch.js";

/**
 * community 単位の定時バッチ CLI エントリ（#306）。
 * スケジューラから Express とは別プロセスで起動する（ADR-0009）。
 * 全 community に対して 1 コミュニティ = 1 API コールで Post + Comment を生成・永続化する。
 */
async function main(): Promise<void> {
  const communityRepo = new PrismaCommunityRepository(prisma);
  const postRepo = new PrismaPostRepository(prisma);
  const commentRepo = new PrismaCommentRepository(prisma);
  const appSettingRepo = new PrismaAppSettingRepository(prisma);
  const batchRunLogRepository = new PrismaBatchRunLogRepository(prisma);

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

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error("[communityBatch] エラー:", err);
  process.exitCode = 1;
});
