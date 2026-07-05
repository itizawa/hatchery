/**
 * 既存ワーカーの imageUrl に残る死んだ source.boringavatars.com URL をクリーンアップするワンショットスクリプト（#1057）。
 *
 * 使い方:
 *   pnpm --filter @hatchery/server cleanup:worker-avatars
 *
 * #1015 でデフォルトアバターの解決方式を「imageUrl 未設定→null（client 側 boring-avatars 描画）」に変更したが、
 * 移行前に DB へ保存された source.boringavatars.com の死んだ URL は imageUrl に残ったまま。
 * resolveWorkerImageUrl は imageUrl が設定されていればそのまま返す設計のため、DB レコードのクリーンアップが必要。
 */

import { isDeadBoringAvatarsWorkerImageUrl } from "@hatchery/common";
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

import { createPrismaWorkerRepository } from "../persistence/prismaWorkerRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";

/** クリーンアップ結果。 */
export interface CleanupResult {
  updatedCount: number;
  updatedIds: string[];
}

/**
 * 死んだ boringavatars URL を持つ Worker を抽出し imageUrl を null に更新するコアロジック。
 * DB アクセスは既存の WorkerRepository（永続化層）に委譲するため、テストは
 * createInMemoryWorkerRepository を注入して DB 接続なしで行える。
 */
export async function runCleanupDeadWorkerAvatarUrls(
  workerRepository: WorkerRepository,
): Promise<CleanupResult> {
  const workers = await workerRepository.listAllBotWorkers();
  const targetIds = workers
    .filter((worker) => isDeadBoringAvatarsWorkerImageUrl(worker.imageUrl))
    .map((worker) => worker.id);

  const updatedIds: string[] = [];
  for (const id of targetIds) {
    const updated = await workerRepository.clearImageUrl(id);
    if (updated) updatedIds.push(id);
  }

  return { updatedCount: updatedIds.length, updatedIds };
}

/**
 * CLI エントリポイント。
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const workerRepository = createPrismaWorkerRepository(prisma);
    const result = await runCleanupDeadWorkerAvatarUrls(workerRepository);

    if (result.updatedCount === 0) {
      console.log("クリーンアップ対象の死んだ boringavatars URL はありませんでした。");
      return;
    }

    console.log(`${result.updatedCount} 件の Worker.imageUrl を null に更新しました。`);
    console.log(`対象ワーカー id: ${result.updatedIds.join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接実行（tsx src/scripts/cleanupDeadWorkerAvatarUrls.ts）のときだけ main を起動する。
// テストからの import ではスクリプトを実行しない。generateReleaseNotes.ts と同じ確立済みパターン。
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("予期しないエラーが発生しました:", err);
    process.exit(1);
  });
}
