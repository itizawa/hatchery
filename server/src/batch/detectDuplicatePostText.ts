/** 類似度判定対象の直近 post（title / text のみで十分な最小フィールド）。#1115 */
export interface RecentPostText {
  title: string;
  text: string;
}

/** 類似投稿が検知された場合の結果。#1115 */
export interface DuplicatePostTextMatch {
  /** 一致した直近 post のタイトル。 */
  matchedTitle: string;
  /** 0〜1 の類似度（1 = 完全一致）。 */
  similarity: number;
}

/** 類似度判定の n-gram サイズ。 */
const NGRAM_SIZE = 3;

/** 類似とみなす閾値（#1115）。完全一致・空白程度の軽微な差異を捕捉しつつ、話題が近いだけの投稿は誤検知しない値。 */
export const DUPLICATE_TEXT_SIMILARITY_THRESHOLD = 0.8;

/** 空白を除去した文字列から n-gram の集合を作る。n 未満の短い文字列はそのまま 1 要素の集合にする。 */
function toNgramSet(input: string): Set<string> {
  const normalized = input.replace(/\s+/g, "");
  if (normalized.length === 0) return new Set();
  if (normalized.length < NGRAM_SIZE) return new Set([normalized]);

  const grams = new Set<string>();
  for (let i = 0; i <= normalized.length - NGRAM_SIZE; i++) {
    grams.add(normalized.slice(i, i + NGRAM_SIZE));
  }
  return grams;
}

/** 2 つの文字列の Jaccard 類似度（0〜1）を計算する。両方空文字列なら 1、片方のみ空なら 0。 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = toNgramSet(a);
  const setB = toNgramSet(b);

  if (setA.size === 0 && setB.size === 0) return a === b ? 1 : 0;

  let intersectionSize = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * 生成された post 本文が直近 post 本文と酷似していないかを検知する（#1115）。
 * 文字 3-gram の Jaccard 類似度による簡易チェック。強いバリデーションではなく、
 * 呼び出し側でログ記録に使うことを想定する（生成失敗にはしない）。
 *
 * recentPosts の中から候補テキストと最も類似度が高いものを選び、
 * 閾値（{@link DUPLICATE_TEXT_SIMILARITY_THRESHOLD}）以上なら一致とみなす。
 */
export function detectSimilarRecentPost({
  candidateText,
  recentPosts,
  threshold = DUPLICATE_TEXT_SIMILARITY_THRESHOLD,
}: {
  candidateText: string;
  recentPosts: readonly RecentPostText[];
  threshold?: number;
}): DuplicatePostTextMatch | null {
  let best: DuplicatePostTextMatch | null = null;

  for (const recentPost of recentPosts) {
    const similarity = jaccardSimilarity(candidateText, recentPost.text);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { matchedTitle: recentPost.title, similarity };
    }
  }

  return best;
}
