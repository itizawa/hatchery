import { Box, Typography, Button } from "../components/uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useHomeFeed } from "../api/communities.js";
import { useVotePost } from "../api/communities.js";
import { PostCard } from "../components/PostCard.js";

/**
 * ホームフィード（/）。購読コミュニティの投稿を新着順で表示する（ADR-0019 / ADR-0020）。
 * 未購読の場合はコミュニティを探す導線を出す。
 */
export const HomeFeedScene = (): ReactElement => {
  const { data: posts, isLoading, error } = useHomeFeed();
  const { mutate: votePost } = useVotePost();

  if (isLoading) {
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
          フィードの取得に失敗しました。ログインしているか確認してください。
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
            購読中のコミュニティに投稿がありません。
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            コミュニティを購読すると、ここにフィードが表示されます。
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
