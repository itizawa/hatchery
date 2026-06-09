import { Box, Stack, Typography } from "./uiParts";

import type { ReactElement } from "react";

export interface TypingIndicatorProps {
  /** いま入力中の発言者の表示名。 */
  name: string;
}

/** ドット 1 個の共通スタイル（3 個を時間差でフェードさせて「●●●」アニメにする）。 */
const dotSx = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  bgcolor: "text.secondary",
  // prefers-reduced-motion 時はフックがドリップ自体を無効化するため通常このコンポーネントは出ないが、
  // 念のためアニメーションも reduced-motion を尊重して静止させる（AC-4・OfficeView と整合）。
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
} as const;

/**
 * 新着メッセージ本文が現れる直前に、その発言者が入力中であることを示すインジケータ（#282 AC-2）。
 * 「発言者名 + ●●● アニメーション」を表示する presentational コンポーネント。
 * スクリーンリーダー向けに role="status" で「<名前> が入力中」を伝える。
 */
export const TypingIndicator = ({ name }: TypingIndicatorProps): ReactElement => {
  return (
    <Box
      role="status"
      aria-label={`${name} が入力中`}
      sx={{
        "@keyframes typing-blink": {
          "0%, 80%, 100%": { opacity: 0.2 },
          "40%": { opacity: 1 },
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" component="span" color="text.secondary">
          {name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} aria-hidden="true">
          <Box sx={{ ...dotSx, animation: "typing-blink 1.2s infinite 0s" }} />
          <Box sx={{ ...dotSx, animation: "typing-blink 1.2s infinite 0.2s" }} />
          <Box sx={{ ...dotSx, animation: "typing-blink 1.2s infinite 0.4s" }} />
        </Stack>
      </Stack>
    </Box>
  );
};
