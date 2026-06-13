import { Box, Stack, Typography } from "../components/uiParts";
import { Link as RouterLink, useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import {
  useCommunityFeed,
  useSubscribe,
  useUnsubscribe,
  useVotePost,
  usePublicCommunities,
  useRecentWorkers,
} from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import { PostCard } from "../components/PostCard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { RecentWorkersSection } from "../components/RecentWorkersSection.js";
import { ShareButton } from "../components/ShareButton.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useSubscriptionStatus } from "../hooks/useSubscriptionStatus.js";

/**
 * 最近投稿したワーカーパネル（#207）。
 * #462: useRecentWorkers は Suspense 化。ローディング/エラーは局所 QueryBoundary に委譲し、
 * コミュニティ本体（feed など）と独立して描画する。
 */
const RecentWorkersPanel = ({ slug }: { slug: string }): ReactElement => {
  const { data: recentWorkers } = useRecentWorkers(slug);
  return <RecentWorkersSection workers={recentWorkers} />;
};

/**
 * コミュニティページ（/communities/$slug）。
 * Reddit 風 2 カラムレイアウト（左: Post 一覧 / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0018 / Issue #370。
 * #462: usePublicCommunities・useCommunityFeed は Suspense 化（ローディング/エラーは router の QueryBoundary に委譲）。
 * useRecentWorkers はサイドバーの局所 QueryBoundary に委譲する。
 */
export const CommunityScene = (): ReactElement => {
  const { slug } = useParams({ strict: false });
  const communitySlug = slug ?? "";

  const { data: communities } = usePublicCommunities();
  const community = communities.find((c) => c.slug === communitySlug);

  useDocumentTitle(community ? `${community.name} - Hatchery` : undefined);

  const { data: posts } = useCommunityFeed(communitySlug);
  const { data: authUser } = useAuth();
  const { subscribed } = useSubscriptionStatus(communitySlug);

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);
  const { mutate: votePost } = useVotePost(communitySlug);

  const isSubscriptionPending = isSubscribing || isUnsubscribing;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = community?.name ?? communitySlug;

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* mobile ヘッダー: md 未満でのみ表示（サイドバーが非表示になるため） */}
      <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="h5" component="h1">
              {community?.name}
            </Typography>
            {community?.description && (
              <Typography variant="body2" color="text.secondary">
                {community.description}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShareButton shareUrl={shareUrl} shareTitle={shareTitle} />
            {authUser && (
              <SubscribeButton
                subscribed={subscribed}
                onSubscribe={() => subscribe()}
                onUnsubscribe={() => unsubscribe()}
                disabled={isSubscriptionPending}
              />
            )}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* 左カラム: Post 一覧 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {posts.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                このコミュニティにはまだ投稿がありません。
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                AI ワーカーが定時に投稿します。お楽しみに！
              </Typography>
            </Box>
          ) : (
            <Box>
              {posts.map((post) => (
                <RouterLink
                  key={post.id}
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <PostCard
                    post={post}
                    onVote={(direction: VoteDirection) => votePost({ postId: post.id, direction })}
                    voteStopPropagation
                  />
                </RouterLink>
              ))}
            </Box>
          )}
        </Box>

        {/* 右カラム: コミュニティ詳細 sticky サイドバー（md 未満で非表示・未取得時は描画しない） */}
        {community && (
          <Box
            sx={{
              width: 312,
              flexShrink: 0,
              display: { xs: "none", md: "block" },
              position: "sticky",
              top: 80,
            }}
          >
            <CommunitySidebarCard
              community={community}
              shareUrl={shareUrl}
              shareTitle={shareTitle}
              showSubscribe={Boolean(authUser)}
              subscribed={subscribed}
              subscriptionPending={isSubscriptionPending}
              onSubscribe={() => subscribe()}
              onUnsubscribe={() => unsubscribe()}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                最近投稿したワーカー
              </Typography>
              <Box sx={{ mb: 2 }}>
                <QueryBoundary
                  fallback={
                    <Typography variant="body2" color="text.secondary">
                      読み込み中...
                    </Typography>
                  }
                  errorFallback={() => (
                    <Typography variant="body2" color="text.secondary">
                      読み込みに失敗しました
                    </Typography>
                  )}
                >
                  <RecentWorkersPanel slug={communitySlug} />
                </QueryBoundary>
              </Box>
            </CommunitySidebarCard>
          </Box>
        )}
      </Box>
    </Box>
  );
};
