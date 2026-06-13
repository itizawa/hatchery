import { Box, Skeleton } from "./uiParts";
import type { ReactElement } from "react";

/**
 * 投稿スレッド（/posts/$postId）のローディングスケルトン（#409 / #462）。
 * usePostThread の Suspense fallback として PostThreadScene の 2 カラム構造を維持したまま表示する。
 * `data-testid="post-thread-skeleton"` でテストから検出できる。
 */
export const PostThreadSkeleton = (): ReactElement => (
  <Box
    component="section"
    data-testid="post-thread-skeleton"
    sx={{ p: 3, maxWidth: 1200, mx: "auto" }}
  >
    <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="text" sx={{ mb: 1 }} />
        <Skeleton variant="text" sx={{ mb: 1 }} />
        <Skeleton variant="text" width="60%" />
      </Box>
      <Box sx={{ width: 312, flexShrink: 0, display: { xs: "none", md: "block" } }}>
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  </Box>
);
