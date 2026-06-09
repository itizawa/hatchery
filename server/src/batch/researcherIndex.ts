import { createPrismaDeps } from "../composition/createPrismaDeps.js";
import { prisma } from "../persistence/prismaClient.js";

import { runResearcherBatch } from "./researcherBatch.js";

/**
 * リサーチャー自律起票バッチの CLI エントリ（#285 / ADR-0016 / ADR-0017）。
 * スケジューラから Express とは別プロセスで起動する（ADR-0004 / ADR-0009）。
 * goal=issue の各チャンネルで Claude Agent SDK のツールループにより
 * 競合調査 → 現状レビュー → GitHub Issue 自律起票を行う。
 *
 * 注意: Agent SDK は query() ごとに claude サブプロセスを起動し約 1GiB RAM を要する（ADR-0011）。
 * 必要な環境変数: ANTHROPIC_API_KEY（または DB の CLAUDE_API_KEY）, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO。
 */
async function main(): Promise<void> {
  const {
    messageRepository: messageRepo,
    channelRepository: channelRepo,
    appSettingRepository: appSettingRepo,
  } = createPrismaDeps(prisma);

  const records = await runResearcherBatch({
    channelRepo,
    messageRepo,
    appSettingRepo,
  });
  console.log(`[researcher] ${records.length} issues created and posted`);
  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
