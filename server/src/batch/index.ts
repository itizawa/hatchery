import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";
import { PrismaChannelMembershipRepository } from "../persistence/prismaChannelMembershipRepository.js";
import { PrismaChannelRepository } from "../persistence/prismaChannelRepository.js";
import { PrismaEmployeeRepository } from "../persistence/prismaEmployeeRepository.js";
import { prisma } from "../persistence/prismaClient.js";
import { PrismaMessageRepository } from "../persistence/prismaMessageRepository.js";

import { runAiMessageBatch } from "./runAiMessageBatch.js";

/**
 * 会話生成バッチの CLI エントリ（#53）。スケジューラから Express とは別プロセスで起動する（ADR-0009）。
 * zatsudan チャンネルの所属 AI 社員（isBot）の掛け合いを Claude で生成して永続化する。
 * 実行頻度は外部 cron（BATCH_SCHEDULE・最大 1 日 4 回）で制御する想定。
 */
async function main(): Promise<void> {
  const messageRepo = new PrismaMessageRepository(prisma);
  const channelRepo = new PrismaChannelRepository(prisma);
  const membershipRepo = new PrismaChannelMembershipRepository(prisma);
  const employeeRepo = new PrismaEmployeeRepository(prisma);
  const appSettingRepo = new PrismaAppSettingRepository(prisma);
  const batchRunLogRepository = new PrismaBatchRunLogRepository(prisma);

  const records = await runAiMessageBatch({
    channelRepo,
    messageRepo,
    membershipRepo,
    employeeRepo,
    appSettingRepo,
    batchRunLogRepository,
  });
  console.log(`[batch] ${records.length} messages created`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
