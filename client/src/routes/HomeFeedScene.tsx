import { Box, Typography } from "../components/uiParts";
import type { HomeFeedSort } from "@hatchery/common";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, type ReactElement } from "react";

import { useInfiniteHomeFeed, usePublicCommunities, useVotePost } from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { PostCard } from "../components/PostCard.js";
import { WelcomeSection } from "../components/WelcomeSection.js";
import type { VoteDirection } from "../components/VoteControl.js";


/** フラットリスト行の hover スタイル（#834）。borderRadius は付けず bgcolor 変化のみ。 */
const listItemSx = {
  "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
  transition: "background-color 150ms ease-out",
} as const;

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
 * #748: vote 連打防止。#890: 押した方向のみ disabled にし、反対方向は操作可能にする。
 */
export const HomeFeedScene = ({ sort = "latest" }: HomeFeedSceneProps): ReactElement => {
  // #462: useInfiniteHomeFeed は Suspense 化。data は non-undefined。
  // ローディング/エラーは router の QueryBoundary に委譲する。
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteHomeFeed(sort);
  const { data: user } = useAuth();
  const { mutate: votePost, isPending: isVotingPost, variables: votingPostVars } = useVotePost();
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // #503: 混在フィードで「どの community の投稿か」を表示するため community_id → community を引く。
  const { data: communities } = usePublicCommunities();
  const communityById = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    if (Array.isArray(communities)) {
      for (const c of communities) map.set(c.id, { slug: c.slug, name: c.name });
    }
    return map;
  }, [communities]);

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
  const showWelcome = !user || !hasPosts;

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h5" component="h1">
          {FEED_HEADING[sort]}
        </Typography>
      </Box>
      {showWelcome && (
        <WelcomeSection communities={Array.isArray(communities) ? communities : []} />
      )}
      {hasPosts && (
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          {posts.map((post) => {
            const community = communityById.get(post.community_id);
            return (
              <Box
                key={post.id}
                sx={listItemSx}
              >
                <RouterLink
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <PostCard
                    post={post}
                    onVote={(direction: VoteDirection) =>
                      votePost({ postId: post.id, direction })
                    }
                    upVoteDisabled={isVotingPost && votingPostVars?.direction === "up"}
                    downVoteDisabled={isVotingPost && votingPostVars?.direction === "down"}
                    voteStopPropagation
                    truncateText
                    variant="list"
                    community={community}
                    currentVote={post.my_vote ?? null}
                    postUrl={`${window.location.origin}/posts/${post.id}`}
                    onCommunityClick={
                      community
                        ? () => void navigate({ to: "/communities/$slug", params: { slug: community.slug } })
                        : undefined
                    }
                    onCommentClick={
                      post.comment_count
                        ? () => void navigate({ to: "/posts/$postId", params: { postId: post.id }, hash: "comments" })
                        : undefined
                    }
                  />
                </RouterLink>
              </Box>
            );
          })}
          <Box ref={sentinelRef} sx={{ py: 1 }}>
            {isFetchingNextPage && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                読み込み中...
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
