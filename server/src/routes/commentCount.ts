import type { CommentRepository, RevealFilterOptions } from "../persistence/commentRepository.js";

/** id を持つレコード（post）の最小形。 */
interface HasId {
  id: string;
}

/**
 * post レコード配列に、そのスレッドのコメント件数（`commentCount`）を付与する（#500）。
 * N+1 を避けるため、対象 post の id をまとめて `countByPostIds` で 1 回集計する。
 * コメントが 0 件の post は `commentCount: 0` を付ける。
 * options.now を渡すと reveal フィルタ済みのコメントのみを集計する（#875）。
 *
 * 解決後の整形（`comment_count` への変換）は `toPostResponse` が担う。
 */
// eslint-disable-next-line max-params
export async function attachCommentCount<T extends HasId>(
  records: readonly T[],
  commentRepo: CommentRepository,
  options?: RevealFilterOptions,
): Promise<Array<T & { commentCount: number }>> {
  if (records.length === 0) return [];
  const counts = await commentRepo.countByPostIds(records.map((r) => r.id), options);
  return records.map((r) => ({ ...r, commentCount: counts.get(r.id) ?? 0 }));
}
