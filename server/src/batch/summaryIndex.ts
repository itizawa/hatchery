import { createPrismaDeps } from "../composition/createPrismaDeps.js";
import { prisma } from "../persistence/prismaClient.js";

import { runSummaryBatch } from "./runSummaryBatch.js";

/**
 * あらすじ更新バッチの CLI エントリ（#53）。会話生成バッチとは別スケジュール（1 日 1 回想定）で起動する。
 * 当日作成されたメッセージを要約し、各チャンネルの summary を更新する。
 * createPrismaDeps で Prisma 実装を共有 composition ヘルパから生成する（Issue #137）。
 */
async function main(): Promise<void> {
  const {
    channelRepository: channelRepo,
    messageRepository: messageRepo,
    appSettingRepository: appSettingRepo,
  } = createPrismaDeps(prisma);

  const updated = await runSummaryBatch({ channelRepo, messageRepo, appSettingRepo });
  console.log(`[summaryBatch] ${updated.length} channel summaries updated`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
