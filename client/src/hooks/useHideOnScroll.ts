import { useCallback, useRef, useState, type UIEvent } from "react";

import { useMediaQuery } from "../components/uiParts/index.js";
import {
  decideHeaderVisibility,
  MIN_SCROLL_DELTA,
  TOP_THRESHOLD,
  type ScrollHeaderState,
} from "../utils/scrollHeader.js";

export interface UseHideOnScrollResult {
  /** ヘッダを非表示にするか。`prefers-reduced-motion: reduce` 時は常に false。 */
  hidden: boolean;
  /** スクロールコンテナの `onScroll` に渡すハンドラ。 */
  onScroll: (event: UIEvent<HTMLElement>) => void;
  /** ユーザーがアニメーション抑制を選好しているか。 */
  prefersReducedMotion: boolean;
}

/**
 * スクロールコンテナのスクロール方向に応じてヘッダの表示／非表示を返す hook（Issue #302）。
 *
 * 判定ロジックは純粋関数 `decideHeaderVisibility` に委譲し、ここでは購読と React state 反映のみ行う。
 * `prefers-reduced-motion: reduce` 環境ではヘッダ自動非表示を無効化し、常に表示する。
 */
export function useHideOnScroll(): UseHideOnScrollResult {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [hidden, setHidden] = useState(false);
  const stateRef = useRef<ScrollHeaderState>({ lastScrollTop: 0, hidden: false });

  const onScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      // アニメーション抑制選好時はヘッダを常時表示にし、判定を行わない
      if (prefersReducedMotion) return;

      const next = decideHeaderVisibility(stateRef.current, {
        currentScrollTop: event.currentTarget.scrollTop,
        topThreshold: TOP_THRESHOLD,
        minDelta: MIN_SCROLL_DELTA,
      });
      stateRef.current = next;
      setHidden((prev) => (prev === next.hidden ? prev : next.hidden));
    },
    [prefersReducedMotion],
  );

  return {
    hidden: prefersReducedMotion ? false : hidden,
    onScroll,
    prefersReducedMotion,
  };
}
