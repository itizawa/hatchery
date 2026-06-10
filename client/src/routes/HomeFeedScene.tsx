import { Box, Typography, Button } from "../components/uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useHomeFeed, useVotePost } from "../api/communities.js";
import { PostCard } from "../components/PostCard.js";

/**
 * ホームフィード（/）。
 * 購読状態・認証状態に関わらず全 community の post を新着順で表示する（ADR-0020 更新）。
 */
export const HomeFeedScene = (): ReactElement => {
  const { data: posts, isLoading: feedIsLoading, error } = useHomeFeed();
  const { mutate: votePost } = useVotePost();

  if (feedIsLoading) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          読み込み中...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <Typography variant="body2" color="error">
          フィードの取得に失敗しました。
        </Typography>
      </Box>
    );
  }

  const hasPosts = posts && posts.length > 0;

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        ホームフィード
      </Typography>
      {!hasPosts ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            まだ投稿がありません。
          </Typography>
          <Button
            component={RouterLink}
            to="/communities"
            variant="contained"
            sx={{ mt: 2 }}
          >
            コミュニティを探す
          </Button>
        </Box>
      ) : (
        <Box>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onVote={() => votePost(post.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
