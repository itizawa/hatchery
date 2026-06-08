import { createPrismaDeps } from "../composition/createPrismaDeps.js";
import { prisma } from "../persistence/prismaClient.js";

import { runAiMessageBatch } from "./runAiMessageBatch.js";

/**
 * 会話生成バッチの CLI エントリ（#53）。スケジューラから Express とは別プロセスで起動する（ADR-0009）。
 * zatsudan チャンネルの所属 AI 社員（isBot）の掛け合いを Claude で生成して永続化する。
 * 実行頻度は外部 cron（BATCH_SCHEDULE・最大 1 日 4 回）で制御する想定。
 * createPrismaDeps で Prisma 実装を共有 composition ヘルパから生成する（Issue #137）。
 */
async function main(): Promise<void> {
  const {
    messageRepository: messageRepo,
    channelRepository: channelRepo,
    channelMembershipRepository: membershipRepo,
    employeeRepository: employeeRepo,
    appSettingRepository: appSettingRepo,
    batchRunLogRepository,
  } = createPrismaDeps(prisma);

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
