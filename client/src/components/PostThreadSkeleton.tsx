import { Box, Skeleton } from "./uiParts";
import type { ReactElement } from "react";
import { PostCard } from "./PostCard.js";
import { CommunitySidebarCard } from "./CommunitySidebarCard.js";
import { CommentCard } from "./CommentCard.js";

/**
 * 投稿スレッド（/posts/$postId）のローディングスケルトン（#409 / #462 / #692 / #807 / #857）。
 * usePostThread の Suspense fallback として PostThreadScene の 2 カラム構造を維持したまま表示する。
 * `data-testid="post-thread-skeleton"` でテストから検出できる。
 * #692: PostThreadScene の実 UI レイアウトと一致させ、ローディング中の CLS を最小化する。
 * #807: PostCard / CommunitySidebarCard の loading prop を使い、Skeleton 専用の手書きレイアウトを廃止。
 *       レイアウトの単一情報源を実 UI コンポーネントに統一する。
 * #857: CommentCard の loading prop を使い、手書き CommentCardSkeleton を廃止。
 */

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
        {/* PostCard（loading 状態）相当（#692 受け入れ条件 2 / #807） */}
        <PostCard loading />
        {/* コメントセクション相当（#692 受け入れ条件 3 / #857） */}
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width={80} sx={{ mb: 1 }} />
          <CommentCard loading />
          <CommentCard loading />
        </Box>
      </Box>
      {/* 右カラム: CommunitySidebarCard（loading 状態）相当（#692 受け入れ条件 4 / #807） */}
      <Box sx={{ width: 312, flexShrink: 0, display: { xs: "none", md: "block" } }}>
        <CommunitySidebarCard loading />
      </Box>
    </Box>
  </Box>
);
