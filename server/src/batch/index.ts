import { PrismaChannelMembershipRepository } from "../persistence/prismaChannelMembershipRepository.js";
import { prisma } from "../persistence/prismaClient.js";
import { PrismaMessageRepository } from "../persistence/prismaMessageRepository.js";
import { PrismaBatchRunLogRepository } from "../persistence/prismaBatchRunLogRepository.js";

import { createRosterMessageGenerator } from "./rosterMessageGenerator.js";
import { runMessageBatch } from "./runMessageBatch.js";

/** 定時バッチの CLI エントリ。スケジューラから Express とは別プロセスで起動する（ADR-0009）。 */
async function main(): Promise<void> {
  const repo = new PrismaMessageRepository(prisma);
  const membershipRepo = new PrismaChannelMembershipRepository(prisma);
  const batchRunLogRepository = new PrismaBatchRunLogRepository(prisma);

  // 各チャンネルに所属する Employee のみを発言候補にする（#33）。
  const membershipByChannel = await membershipRepo.listMembershipByChannel();
  const generate = createRosterMessageGenerator({ membershipByChannel });

  const records = await runMessageBatch({ messageRepository: repo, generate, batchRunLogRepository });
  console.log(`[batch] ${records.length} messages created`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
