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

/** Worker の id と imageUrl のみを持つ行（クリーンアップ対象判定に必要な最小情報）。 */
export interface WorkerAvatarRow {
  id: string;
  imageUrl: string | null;
}

/** クリーンアップ処理が必要とする DB アクセスの狭いインターフェース（テスト時にモック注入可能にする）。 */
export interface WorkerAvatarCleanupClient {
  /** imageUrl が設定済みの Worker を id/imageUrl のみ取得する。 */
  findWorkersWithImageUrl(): Promise<WorkerAvatarRow[]>;
  /** 指定した id の Worker の imageUrl を null に更新し、更新件数を返す。 */
  clearImageUrl(ids: string[]): Promise<number>;
}

/** クリーンアップ結果。 */
export interface CleanupResult {
  updatedCount: number;
  updatedIds: string[];
}

/**
 * 死んだ boringavatars URL を持つ Worker を抽出し imageUrl を null に更新するコアロジック。
 * DB アクセスを client に委譲しているため DB 接続なしでテストできる。
 */
export async function runCleanupDeadWorkerAvatarUrls(
  client: WorkerAvatarCleanupClient,
): Promise<CleanupResult> {
  const rows = await client.findWorkersWithImageUrl();
  const targetIds = rows
    .filter((row) => isDeadBoringAvatarsWorkerImageUrl(row.imageUrl))
    .map((row) => row.id);

  if (targetIds.length === 0) {
    return { updatedCount: 0, updatedIds: [] };
  }

  const updatedCount = await client.clearImageUrl(targetIds);
  return { updatedCount, updatedIds: targetIds };
}

/** 実 Prisma を使う WorkerAvatarCleanupClient を作る（本番経路）。 */
function createPrismaWorkerAvatarCleanupClient(prisma: PrismaClient): WorkerAvatarCleanupClient {
  return {
    async findWorkersWithImageUrl(): Promise<WorkerAvatarRow[]> {
      return prisma.worker.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, imageUrl: true },
      });
    },
    async clearImageUrl(ids: string[]): Promise<number> {
      const result = await prisma.worker.updateMany({
        where: { id: { in: ids } },
        data: { imageUrl: null },
      });
      return result.count;
    },
  };
}

/**
 * CLI エントリポイント。
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const client = createPrismaWorkerAvatarCleanupClient(prisma);
    const result = await runCleanupDeadWorkerAvatarUrls(client);

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
