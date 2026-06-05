import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import type { ReactElement } from "react";

const SKELETON_COUNT = 4;

export const ChannelListSkeleton = (): ReactElement => (
  <Box aria-label="チャンネル一覧読み込み中">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width="80%"
        height={36}
        data-testid="channel-list-skeleton-item"
        sx={{ my: 0.5 }}
      />
    ))}
  </Box>
);
