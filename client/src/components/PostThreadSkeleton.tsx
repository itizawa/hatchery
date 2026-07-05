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
 * #955: 右カラムに position:sticky / top:24 を追加し、PostThreadScene.SidebarColumn と sx を一致させる。
 * #1077: 外枠に width:"100%" を追加。RootLayout の column flex（main）直下では、cross軸（幅）の
 *         auto margin（mx:"auto"）が align-items:stretch より優先される（CSS Flexbox 仕様 8.2）ため、
 *         width が auto のままだと stretch が効かず shrink-to-fit サイズになり左カラムが潰れていた。
 *         width:"100%" で明示的な cross size を与えることで、maxWidth 適用後の残り幅を mx:"auto" が
 *         正しく中央寄せできるようになる。
 */

export const PostThreadSkeleton = (): ReactElement => (
  <Box
    component="section"
    data-testid="post-thread-skeleton"
    sx={{ p: 3, maxWidth: 1200, mx: "auto", width: "100%" }}
  >
    <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
      {/* 左カラム: コミュニティパンくず + PostCard + コメントセクション */}
      <Box sx={{ flex: 1, minWidth: 0 }} data-testid="post-thread-skeleton-left">
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
      {/* CLS 最小化のため PostThreadScene.SidebarColumn と sticky sx を揃える */}
      <Box
        sx={{
          width: 312,
          flexShrink: 0,
          display: { xs: "none", md: "block" },
          position: "sticky",
          top: 24,
        }}
        data-testid="post-thread-skeleton-sidebar"
      >
        <CommunitySidebarCard loading />
      </Box>
    </Box>
  </Box>
);
