import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import type { ReactElement } from "react";

const MESSAGE_SKELETON_COUNT = 4;

export const ChannelViewSkeleton = (): ReactElement => (
  <Box sx={{ p: 2 }}>
    <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
    {Array.from({ length: MESSAGE_SKELETON_COUNT }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={`${60 + (i % 3) * 15}%`}
        height={28}
        data-testid="channel-view-skeleton-item"
        sx={{ my: 0.5 }}
      />
    ))}
  </Box>
);
