import type { CommentRepository } from "../persistence/commentRepository.js";

/** id を持つレコード（post）の最小形。 */
interface HasId {
  id: string;
}

/**
 * post レコード配列に、そのスレッドのコメント件数（`commentCount`）を付与する（#500）。
 * N+1 を避けるため、対象 post の id をまとめて `countByPostIds` で 1 回集計する。
 * コメントが 0 件の post は `commentCount: 0` を付ける。
 *
 * 解決後の整形（`comment_count` への変換）は `toPostResponse` が担う。
 */
export async function attachCommentCount<T extends HasId>(
  records: readonly T[],
  commentRepo: CommentRepository,
): Promise<Array<T & { commentCount: number }>> {
  if (records.length === 0) return [];
  const counts = await commentRepo.countByPostIds(records.map((r) => r.id));
  return records.map((r) => ({ ...r, commentCount: counts.get(r.id) ?? 0 }));
}
