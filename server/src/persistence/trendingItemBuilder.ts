/**
 * TrendingItem（#1065）の excerpt 構築ロジック。
 * in-memory / Prisma 両方の VoteRepository 実装から共有する。
 * SQL の SUBSTRING はマルチバイト文字のコードポイント単位切り詰めとして信頼できないため、
 * TypeScript 側でコードポイント単位（CommentCard.tsx の truncateCodePoints 相当）に切り詰める。
 */

/** excerpt の切り詰め文字数（コードポイント単位）。 */
export const TRENDING_EXCERPT_LIMIT = 60;

/**
 * 本文冒頭をコードポイント単位で切り詰め、超過時は "…" を付与する。
 * サロゲートペア（絵文字等）の途中で切れるのを防ぐ。
 */
export function buildTrendingExcerpt(text: string): string {
  const chars = [...text];
  return chars.length > TRENDING_EXCERPT_LIMIT
    ? chars.slice(0, TRENDING_EXCERPT_LIMIT).join("") + "…"
    : text;
}
