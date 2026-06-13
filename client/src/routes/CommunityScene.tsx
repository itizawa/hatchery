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
import { CommunityHeader } from "../components/CommunityHeader.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import { PostCard } from "../components/PostCard.js";
import { RecentWorkersSection } from "../components/RecentWorkersSection.js";
import { ShareButton } from "../components/ShareButton.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { SubscriptionStatus } from "../components/SubscriptionStatus.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

/**
 * コミュニティページ（/communities/$slug）。
 * Reddit 風 2 カラムレイアウト（左: Post 一覧 / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0018 / Issue #370。
 */
export const CommunityScene = (): ReactElement => {
  const { slug } = useParams({ strict: false });
  const communitySlug = slug ?? "";

  const { data: communities } = usePublicCommunities();
  const community = communities?.find((c) => c.slug === communitySlug);

  useDocumentTitle(community ? `${community.name} - Hatchery` : undefined);

  const { data: posts, isLoading } = useCommunityFeed(communitySlug);
  const { data: authUser } = useAuth();

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);
  const { mutate: votePost } = useVotePost(communitySlug);
  const {
    data: recentWorkers,
    isLoading: isRecentWorkersLoading,
    isError: isRecentWorkersError,
  } = useRecentWorkers(communitySlug);

  const isSubscriptionPending = isSubscribing || isUnsubscribing;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = community?.name ?? communitySlug;

  return (
    <SubscriptionStatus communitySlug={communitySlug}>
      {(subscribed) => (
        <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
          {/* Reddit 風ヘッダー: カバー画像＋左下に重ねた丸いアイコン＋name（#457） */}
          {community && (
            <CommunityHeader
              community={community}
              actions={
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
              }
            />
          )}

          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
            {/* 左カラム: Post 一覧 */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  読み込み中...
                </Typography>
              ) : !posts || posts.length === 0 ? (
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
                        onVote={(direction: VoteDirection) =>
                          votePost({ postId: post.id, direction })
                        }
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
                    <RecentWorkersSection
                      workers={recentWorkers ?? []}
                      isLoading={isRecentWorkersLoading}
                      isError={isRecentWorkersError}
                    />
                  </Box>
                </CommunitySidebarCard>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </SubscriptionStatus>
  );
};
