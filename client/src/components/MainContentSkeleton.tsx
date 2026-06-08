import { Box, Skeleton } from "./uiParts";

import type { ReactElement } from "react";

const BODY_LINE_COUNT = 5;

export const MainContentSkeleton = (): ReactElement => (
  <Box sx={{ p: 3 }} aria-label="コンテンツ読み込み中">
    <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
    {Array.from({ length: BODY_LINE_COUNT }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={`${75 - (i % 3) * 10}%`}
        height={24}
        data-testid="main-content-skeleton-item"
        sx={{ my: 0.5 }}
      />
    ))}
  </Box>
);
