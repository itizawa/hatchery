import { Box, Typography, Button } from "../components/uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, type ReactElement } from "react";

import { useInfiniteHomeFeed, useVotePost } from "../api/communities.js";
import { PostCard } from "../components/PostCard.js";
import type { VoteDirection } from "../components/VoteControl.js";

/**
 * ホームフィード（/）。
 * 購読状態・認証状態に関わらず全 community の post を新着順で表示する（ADR-0020 更新）。
 * #367: 無限スクロール（カーソルページネーション）対応。
 */
export const HomeFeedScene = (): ReactElement => {
  const {
    data,
    isLoading: feedIsLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteHomeFeed();
  const { mutate: votePost } = useVotePost();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const hasPosts = posts.length > 0;

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
              onVote={(direction: VoteDirection) => votePost({ postId: post.id, direction })}
              voteStopPropagation
            />
          ))}
          <Box ref={sentinelRef} sx={{ py: 1 }}>
            {isFetchingNextPage && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                読み込み中...
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
