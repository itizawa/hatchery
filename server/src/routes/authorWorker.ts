import type { AuthorWorker } from "@hatchery/common";
import { buildAuthorWorkerResolver } from "@hatchery/common";

import type { WorkerRepository } from "../persistence/workerRepository.js";

/** author を持つレコード（post / comment）の最小形。 */
interface HasAuthor {
  author: string;
}

/** レコードに author_worker を付与する同期関数。 */
export type AuthorWorkerEnricher = <T extends HasAuthor>(
  records: readonly T[],
) => Array<T & { author_worker?: AuthorWorker }>;

function enrichWith<T extends HasAuthor>(
  records: readonly T[],
  resolve: (author: string) => AuthorWorker | undefined,
): Array<T & { author_worker?: AuthorWorker }> {
  return records.map((record) => {
    const author_worker = resolve(record.author);
    return author_worker ? { ...record, author_worker } : { ...record };
  });
}

/**
 * 有効な（論理削除されていない）ワーカーを **1 回だけ** 取得して、レコードに
 * `author_worker` を付与する同期 enricher を組み立てる（#479）。
 * 1 リクエストで複数のコレクション（post + comments）を付与する経路で、ワーカー取得の重複を避ける。
 *
 * author→Worker の解決セマンティクス（id 優先 → displayName 照合）は #478 と整合させている。
 */
export async function buildAuthorWorkerEnricher(
  workerRepo: WorkerRepository,
): Promise<AuthorWorkerEnricher> {
  const workers = await workerRepo.listBotWorkers();
  const resolve = buildAuthorWorkerResolver(workers);
  return (records) => enrichWith(records, resolve);
}

/**
 * 単一コレクション（feed / community feed）の post レコードに `author_worker` を付与する（#479）。
 * 解決できない author のレコードは `author_worker` を付けずにそのまま返す（client が生 author にフォールバック）。
 */
export async function attachAuthorWorker<T extends HasAuthor>(
  records: readonly T[],
  workerRepo: WorkerRepository,
): Promise<Array<T & { author_worker?: AuthorWorker }>> {
  if (records.length === 0) return [];
  const enrich = await buildAuthorWorkerEnricher(workerRepo);
  return enrich(records);
}
