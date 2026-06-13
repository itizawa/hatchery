import type { AuthorWorker } from "@hatchery/common";
import { buildAuthorWorkerResolver } from "@hatchery/common";

import type { WorkerRepository } from "../persistence/workerRepository.js";

/** author を持つレコード（post / comment）の最小形。 */
interface HasAuthor {
  author: string;
}

/**
 * post / comment レコードに、発言者の表示用ワーカー情報 `author_worker` を付与する（#479）。
 *
 * - 有効な（論理削除されていない）ワーカーを 1 回だけ取得して resolver を組み立てる。
 * - 各レコードの `author`（id か displayName）を解決し、解決できたものだけ `author_worker` を付与する。
 * - 解決できない author のレコードは `author_worker` を付けずにそのまま返す（client が生 author にフォールバック）。
 *
 * author→Worker の解決セマンティクス（id 優先 → displayName 照合）は #478 と整合させている。
 */
export async function attachAuthorWorker<T extends HasAuthor>(
  records: readonly T[],
  workerRepo: WorkerRepository,
): Promise<Array<T & { author_worker?: AuthorWorker }>> {
  if (records.length === 0) return [];
  const workers = await workerRepo.listBotWorkers();
  const resolve = buildAuthorWorkerResolver(workers);
  return records.map((record) => {
    const author_worker = resolve(record.author);
    return author_worker ? { ...record, author_worker } : { ...record };
  });
}
