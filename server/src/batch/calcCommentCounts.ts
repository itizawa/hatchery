import type { PostRecord } from "../persistence/postRepository.js";

export const COMMENT_BATCH_BASE = 1;
export const COMMENT_BATCH_K = 0.5;
export const COMMENT_BATCH_MIN = 1;
export const COMMENT_BATCH_MAX = 5;
export const REVIVAL_PROBABILITY = 0.1;

/** post の vote スコアに応じたコメント数を返す（#673）。 */
// eslint-disable-next-line max-params
export function calcCommentCount(
  score: number,
  params: {
    base?: number;
    k?: number;
    min?: number;
    max?: number;
  } = {},
): number {
  const base = params.base ?? COMMENT_BATCH_BASE;
  const k = params.k ?? COMMENT_BATCH_K;
  const min = params.min ?? COMMENT_BATCH_MIN;
  const max = params.max ?? COMMENT_BATCH_MAX;
  const effectiveScore = Math.max(0, score);
  const raw = base + Math.round(k * effectiveScore);
  return Math.min(max, Math.max(min, raw));
}

/**
 * 確率 p で oldPosts から1件をランダムに選んで返す（#673 古い post 活性化）。
 * rng() >= p または oldPosts が空の場合は null を返す。
 */
// eslint-disable-next-line max-params
export function pickOldPostForRevival(
  oldPosts: readonly PostRecord[],
  p: number,
  rng: () => number,
): PostRecord | null {
  if (oldPosts.length === 0) return null;
  if (rng() >= p) return null;
  const idx = Math.floor(rng() * oldPosts.length);
  return oldPosts[idx] ?? null;
}
