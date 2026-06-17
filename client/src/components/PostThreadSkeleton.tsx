import { Box, Divider, Skeleton } from "./uiParts";
import type { ReactElement } from "react";

/**
 * 投稿スレッド（/posts/$postId）のローディングスケルトン（#409 / #462 / #692）。
 * usePostThread の Suspense fallback として PostThreadScene の 2 カラム構造を維持したまま表示する。
 * `data-testid="post-thread-skeleton"` でテストから検出できる。
 * #692: PostThreadScene の実 UI レイアウトと一致させ、ローディング中の CLS を最小化する。
 */

/** PostCard 相当のスケルトン。実 UI の PostCard レイアウト（左: VoteControl / 右: コンテンツ）に対応。 */
const PostCardSkeleton = (): ReactElement => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 1,
      p: 2,
      bgcolor: "background.paper",
      mb: 1,
    }}
  >
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      {/* 左: VoteControl 相当（縦長ボタンエリア） */}
      <Skeleton variant="rectangular" width={32} height={64} sx={{ borderRadius: 0.5 }} />
      {/* 右: タイトル・byline・本文・アクションバー */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="70%" sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="30%" sx={{ mt: 1 }} />
      </Box>
    </Box>
  </Box>
);

/** コメントカード相当のスケルトン 1 件。 */
const CommentCardSkeleton = (): ReactElement => (
  <Box sx={{ mb: 1 }}>
    <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mb: 0.5 }} />
    <Skeleton variant="text" width="60%" />
  </Box>
);

/** CommunitySidebarCard 相当のスケルトン（右サイドバー）。 */
const CommunitySidebarSkeleton = (): ReactElement => (
  <Box
    sx={{
      border: 1,
      borderColor: "divider",
      borderRadius: 1,
      p: 2,
    }}
  >
    {/* Avatar + コミュニティ名 */}
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 0.5 }}>
      <Skeleton variant="circular" width={40} height={40} />
      <Skeleton variant="text" width="60%" />
    </Box>
    <Divider sx={{ mb: 1 }} />
    {/* 説明文 */}
    <Skeleton variant="text" sx={{ mb: 0.5 }} />
    <Skeleton variant="text" width="80%" sx={{ mb: 1 }} />
    {/* ボタン（ShareButton / SubscribeButton 相当） */}
    <Skeleton variant="rectangular" height={36} width="100%" sx={{ borderRadius: 1 }} />
  </Box>
);

export const PostThreadSkeleton = (): ReactElement => (
  <Box
    component="section"
    data-testid="post-thread-skeleton"
    sx={{ p: 3, maxWidth: 1200, mx: "auto" }}
  >
    <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
      {/* 左カラム: コミュニティパンくず + PostCard + コメントセクション */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* コミュニティパンくず相当（#692 受け入れ条件 1） */}
        <Skeleton variant="text" width={80} sx={{ mb: 1 }} />
        {/* PostCard 相当（#692 受け入れ条件 2） */}
        <PostCardSkeleton />
        {/* コメントセクション相当（#692 受け入れ条件 3） */}
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width={80} sx={{ mb: 1 }} />
          <CommentCardSkeleton />
          <CommentCardSkeleton />
        </Box>
      </Box>
      {/* 右カラム: CommunitySidebarCard 相当（#692 受け入れ条件 4） */}
      <Box sx={{ width: 312, flexShrink: 0, display: { xs: "none", md: "block" } }}>
        <CommunitySidebarSkeleton />
      </Box>
    </Box>
  </Box>
);
