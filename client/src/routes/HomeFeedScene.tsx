import { Box, Typography, Button } from "../components/uiParts";
import type { HomeFeedSort } from "@hatchery/common";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, type ReactElement } from "react";

import { useInfiniteHomeFeed, useVotePost } from "../api/communities.js";
import { LoginPromptSnackbar } from "../components/LoginPromptSnackbar.js";
import { PostCard } from "../components/PostCard.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { useGuestVoteGuard } from "../hooks/useGuestVoteGuard.js";

/** sort ごとの画面見出し。 */
const FEED_HEADING: Record<HomeFeedSort, string> = {
  latest: "ホームフィード",
  popular: "人気の投稿",
};

export interface HomeFeedSceneProps {
  /** フィードの並び順。latest=新着順（/）/ popular=vote 数降順（/popular）。既定は latest。 */
  sort?: HomeFeedSort;
}

/**
 * ホームフィード（/ = 新着順 / /popular = 人気順）。
 * 購読状態・認証状態に関わらず全 community の post を表示する（ADR-0020 更新）。
 * #367: 無限スクロール（カーソルページネーション）対応。#435: 並び順パラメータ化。
 */
export const HomeFeedScene = ({ sort = "latest" }: HomeFeedSceneProps): ReactElement => {
  // #462: useInfiniteHomeFeed は Suspense 化。data は non-undefined。
  // ローディング/エラーは router の QueryBoundary に委譲する。
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteHomeFeed(sort);
  const { mutate: votePost } = useVotePost();
  const { guardVote, promptOpen, closePrompt } = useGuestVoteGuard();
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

  const posts = data.pages.flatMap((page) => page.posts);
  const hasPosts = posts.length > 0;

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {FEED_HEADING[sort]}
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
              onVote={(direction: VoteDirection) =>
                guardVote(() => votePost({ postId: post.id, direction }))
              }
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
      <LoginPromptSnackbar open={promptOpen} onClose={closePrompt} />
    </Box>
  );
};
