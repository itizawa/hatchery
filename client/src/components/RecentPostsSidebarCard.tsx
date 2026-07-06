import { Box, Divider, Typography } from "./uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { Post } from "../api/posts.js";
import { PostedTime } from "./PostedTime.js";
import { sidebarCardOuterBoxSx, sidebarListItemSx, sidebarListItemTitleSx } from "./sidebarCardSx.js";

export interface PostCardCommunityInfo {
  slug: string;
  name: string;
}

interface RecentPostsSidebarCardProps {
  posts: Post[];
  communityById: Map<string, PostCardCommunityInfo>;
}

/**
 * ホームフィード右サイドバー用の横断新着ポスト一覧カード（#928）。
 * 最新 10 件の投稿をコンパクトリスト（タイトル・本文冒頭・コミュニティ名・投稿時刻）で表示する。
 * 投票ボタンは表示しない（読み取り専用）。
 */
export const RecentPostsSidebarCard = ({
  posts,
  communityById,
}: RecentPostsSidebarCardProps): ReactElement => {
  return (
    <Box sx={sidebarCardOuterBoxSx}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
        新着ポスト
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      {posts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          新着投稿がありません
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          {posts.map((post) => {
            const community = communityById.get(post.community_id);
            return (
              <Box component="li" key={post.id} sx={sidebarListItemSx}>
                <RouterLink
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Typography variant="body2" sx={sidebarListItemTitleSx}>
                    {post.title}
                  </Typography>
                </RouterLink>
                {post.text && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      overflow: "hidden",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                      mt: 0.25,
                    }}
                  >
                    {post.text}
                  </Typography>
                )}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                  {community && (
                    <RouterLink
                      to="/communities/$slug"
                      params={{ slug: community.slug }}
                      style={{ textDecoration: "none" }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          "&:hover": { color: "primary.main" },
                          transition: "color 150ms ease-out",
                        }}
                      >
                        {community.name}
                      </Typography>
                    </RouterLink>
                  )}
                  {community && post.created_at && (
                    <Typography variant="caption" color="text.disabled">
                      ·
                    </Typography>
                  )}
                  <PostedTime createdAt={post.created_at} variant="caption" />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
