import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import { type RefObject, useEffect, useState, type ReactElement } from "react";

import { Box, Fab, Fade } from "./uiParts";

interface ScrollToTopButtonProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
}

/**
 * スクロールコンテナが 300px 以上スクロールされたら画面右下に表示するトップ戻し FAB（#689）。
 */
export const ScrollToTopButton = ({ scrollContainerRef }: ScrollToTopButtonProps): ReactElement => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setVisible(container.scrollTop >= 300);
    };

    // マウント時に現在の scrollTop で初期状態を同期する（ナビゲーション後の再マウント時も正確に反映するため）
    handleScroll();
    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef]);

  const handleClick = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Fade in={visible}>
      <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: "fab" }}>
        <Fab size="small" aria-label="トップへ戻る" onClick={handleClick} color="primary">
          <KeyboardArrowUpIcon />
        </Fab>
      </Box>
    </Fade>
  );
};
