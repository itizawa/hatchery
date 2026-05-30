import { prisma } from "../persistence/prismaClient.js";
import { PrismaSceneRepository } from "../persistence/prismaSceneRepository.js";

import { runSceneBatch } from "./runSceneBatch.js";

/** 定時バッチの CLI エントリ。スケジューラから Express とは別プロセスで起動する。 */
async function main(): Promise<void> {
  const repo = new PrismaSceneRepository(prisma);
  const record = await runSceneBatch({ sceneRepository: repo });
  console.log(`[batch] scene created: ${record.id}`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
