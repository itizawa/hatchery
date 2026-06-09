/** scrollTop の差分がこの値未満のスクロールは無視する（チラつき防止）。 */
export const HEADER_SCROLL_THRESHOLD = 5;

/**
 * スクロール方向からヘッダの表示可否を算出する純粋関数。
 *
 * @param prevScrollTop - 前回のスクロール位置（px）
 * @param currentScrollTop - 現在のスクロール位置（px）
 * @param threshold - 状態変化を発生させる最小スクロール量（px）
 * @param currentVisible - 現在の表示状態
 * @returns 新しい表示状態
 */
export function computeHeaderVisibility(
  prevScrollTop: number,
  currentScrollTop: number,
  threshold: number,
  currentVisible: boolean,
): boolean {
  if (currentScrollTop <= 0) return true;
  const delta = currentScrollTop - prevScrollTop;
  if (Math.abs(delta) <= threshold) return currentVisible;
  return delta < 0;
}
