import { useCallback, useRef, useState, type UIEvent } from "react";
import { computeHeaderVisibility, HEADER_SCROLL_THRESHOLD } from "../utils/scrollHeader.js";

export function useHideOnScroll(threshold = HEADER_SCROLL_THRESHOLD) {
  const [visible, setVisible] = useState(true);
  const prevScrollTopRef = useRef(0);

  const onScroll = useCallback(
    (e: UIEvent<HTMLElement>) => {
      const currentScrollTop = e.currentTarget.scrollTop;
      // prevScrollTop をローカルにキャプチャしてから ref を更新する。
      // setVisible に渡す関数アップデータは React が遅延実行する場合があるため、
      // クロージャで prevScrollTop を確定させることで競合を防ぐ。
      const prevScrollTop = prevScrollTopRef.current;
      prevScrollTopRef.current = currentScrollTop;
      setVisible((prev) =>
        computeHeaderVisibility(prevScrollTop, currentScrollTop, threshold, prev),
      );
    },
    [threshold],
  );

  return { visible, onScroll };
}
