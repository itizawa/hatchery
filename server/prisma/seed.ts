import { PrismaClient } from "@prisma/client";

import { seedDevData } from "./seedDevData.js";

/**
 * `prisma db seed` から起動される CLI エントリ。
 * 実 PrismaClient を生成して seedDevData に委譲し、最後に切断する。
 * 投入ロジック本体・本番ガードは seedDevData 側に集約している（設計書 §4）。
 */
const prisma = new PrismaClient();

async function main() {
  const result = await seedDevData(prisma);
  if (result.skipped) {
    console.log("本番環境ではシードを実行しません");
    return;
  }
  console.log("シードを投入しました: testuser / testpass・既定の社員・チャンネル");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
