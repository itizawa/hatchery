/**
 * スクロール方向に応じた AppHeader の表示／非表示を判定する純粋関数群（Issue #302）。
 * 副作用（DOM・React state）を持たず、ロジック単体で Vitest テスト可能にする。
 */

/** 最上部付近とみなすスクロール位置のしきい値（px）。これ以下では常にヘッダを表示する。 */
export const TOP_THRESHOLD = 16;

/** チラつき防止のための最小スクロール量（px）。これ未満の移動は方向判定に使わず状態を維持する。 */
export const MIN_SCROLL_DELTA = 8;

export interface ScrollHeaderState {
  /** 直近で方向判定に採用したスクロール位置（px）。 */
  lastScrollTop: number;
  /** ヘッダを非表示にするか。 */
  hidden: boolean;
}

export interface DecideHeaderVisibilityParams {
  /** 現在のスクロール位置（px）。 */
  currentScrollTop: number;
  /** 最上部付近とみなすしきい値（px）。 */
  topThreshold: number;
  /** チラつき防止の最小スクロール量（px）。 */
  minDelta: number;
}

/**
 * 直前の状態と現在のスクロール位置から次のヘッダ表示状態を決める。
 *
 * - 最上部付近（`currentScrollTop <= topThreshold`）では常に表示する。
 * - しきい値未満の微小スクロールでは状態・基準位置を維持してチラつきを防ぐ。
 * - 下方向スクロールでは非表示、上方向スクロールでは表示にする。
 */
export function decideHeaderVisibility(
  prev: ScrollHeaderState,
  { currentScrollTop, topThreshold, minDelta }: DecideHeaderVisibilityParams,
): ScrollHeaderState {
  // 負のスクロール位置（バウンス等）は 0 に丸める
  const current = Math.max(0, currentScrollTop);

  // 最上部付近では常に表示し、基準位置も更新する
  if (current <= topThreshold) {
    return { lastScrollTop: current, hidden: false };
  }

  const delta = current - prev.lastScrollTop;

  // 微小スクロールは無視して状態・基準位置を維持（累積誤判定とチラつきを防ぐ）
  if (Math.abs(delta) < minDelta) {
    return prev;
  }

  // 下方向（delta > 0）で非表示、上方向で表示
  return { lastScrollTop: current, hidden: delta > 0 };
}
