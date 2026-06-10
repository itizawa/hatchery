import { Box, Divider, Stack, Typography } from "../components/uiParts";
import { Link as RouterLink, useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useCommunityFeed, useSubscribe, useUnsubscribe, useVotePost, usePublicCommunities } from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { PostCard } from "../components/PostCard.js";
import { ShareButton } from "../components/ShareButton.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useSubscriptionStatus } from "../hooks/useSubscriptionStatus.js";

const formatCreatedAt = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 作成`;
};

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
                    onVote={(direction: VoteDirection) => votePost({ postId: post.id, direction })}
                    voteStopPropagation
                  />
                </RouterLink>
              ))}
            </Box>
          )}
        </Box>

        {/* 右カラム: コミュニティ詳細 sticky サイドバー（md 未満で非表示） */}
        <Box
          sx={{
            width: 312,
            flexShrink: 0,
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 80,
          }}
        >
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
            }}
          >
            <Typography variant="h6" component="h2" gutterBottom>
              {community?.name}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {community?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {community.description}
              </Typography>
            )}
            {community?.created_at && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {formatCreatedAt(community.created_at)}
              </Typography>
            )}
            <Stack spacing={1}>
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
      </Box>
    </Box>
  );
};
