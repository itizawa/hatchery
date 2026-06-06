import { PrismaAppSettingRepository } from "../persistence/prismaAppSettingRepository.js";
import { PrismaChannelRepository } from "../persistence/prismaChannelRepository.js";
import { prisma } from "../persistence/prismaClient.js";
import { PrismaMessageRepository } from "../persistence/prismaMessageRepository.js";

import { runSummaryBatch } from "./runSummaryBatch.js";

/**
 * あらすじ更新バッチの CLI エントリ（#53）。会話生成バッチとは別スケジュール（1 日 1 回想定）で起動する。
 * 当日作成されたメッセージを要約し、各チャンネルの summary を更新する。
 */
async function main(): Promise<void> {
  const channelRepo = new PrismaChannelRepository(prisma);
  const messageRepo = new PrismaMessageRepository(prisma);
  const appSettingRepo = new PrismaAppSettingRepository(prisma);

  const updated = await runSummaryBatch({ channelRepo, messageRepo, appSettingRepo });
  console.log(`[summaryBatch] ${updated.length} channel summaries updated`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
