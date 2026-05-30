import { prisma } from "../persistence/prismaClient.js";
import { PrismaMessageRepository } from "../persistence/prismaMessageRepository.js";

import { runMessageBatch } from "./runMessageBatch.js";

/** 定時バッチの CLI エントリ。スケジューラから Express とは別プロセスで起動する（ADR-0009）。 */
async function main(): Promise<void> {
  const repo = new PrismaMessageRepository(prisma);
  const records = await runMessageBatch({ messageRepository: repo });
  console.log(`[batch] ${records.length} messages created`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
