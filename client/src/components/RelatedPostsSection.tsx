import { Box, Typography } from "./uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { Post } from "../api/posts.js";
import { PostedTime } from "./PostedTime.js";

export interface RelatedPostsSectionProps {
  /** 同一 community 内でタグを 1 つ以上共有する投稿一覧（サーバ側で新着順・最大件数まで絞り込み済み）。 */
  posts: Post[];
}

/**
 * 投稿詳細ページの「関連投稿」セクション（#1087）。
 * Reddit 風のフラットリスト（カード枠・シャドウなし、border-bottom 区切り）で表示する。
 * posts が空のときは何も描画しない（呼び出し側でセクション自体の有無を判定できるよう null を返す）。
 */
export const RelatedPostsSection = ({ posts }: RelatedPostsSectionProps): ReactElement | null => {
  if (posts.length === 0) return null;

  return (
    <Box data-testid="related-posts-section" sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "text.secondary" }}>
        関連投稿
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {posts.map((post) => (
          <Box
            component="li"
            key={post.id}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              py: 1.25,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <RouterLink
              to="/posts/$postId"
              params={{ postId: post.id }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  "&:hover": { color: "primary.main" },
                  transition: "color 150ms ease-out",
                }}
              >
                {post.title}
              </Typography>
            </RouterLink>
            <PostedTime createdAt={post.created_at} variant="caption" />
          </Box>
        ))}
      </Box>
    </Box>
  );
};
