import { Box, Typography } from "../components/uiParts";
import { useParams } from "@tanstack/react-router";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useCommunityFeed, useSubscribe, useUnsubscribe, useVotePost, usePublicCommunities } from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { PostCard } from "../components/PostCard.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { useSubscriptionStatus } from "../hooks/useSubscriptionStatus.js";

/**
 * コミュニティページ（/communities/$slug）。
 * コミュニティのフィードと購読/購読解除ボタンを表示する（ADR-0018 / ADR-0019 / ADR-0020）。
 */
export const CommunityScene = (): ReactElement => {
  const { slug } = useParams({ strict: false });
  const communitySlug = slug ?? "";

  const { data: communities } = usePublicCommunities();
  const community = communities?.find((c) => c.slug === communitySlug);

  const { data: posts, isLoading } = useCommunityFeed(communitySlug);
  const { data: authUser } = useAuth();
  const { subscribed } = useSubscriptionStatus(communitySlug);

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);
  const { mutate: votePost } = useVotePost(communitySlug);

  const isSubscriptionPending = isSubscribing || isUnsubscribing;

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography variant="h5" component="h1">
            r/{communitySlug}
          </Typography>
          {community && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {community.name}
              </Typography>
              {community.description && (
                <Typography variant="body2" color="text.secondary">
                  {community.description}
                </Typography>
              )}
            </>
          )}
        </Box>
        {authUser && (
          <SubscribeButton
            subscribed={subscribed}
            onSubscribe={() => subscribe()}
            onUnsubscribe={() => unsubscribe()}
            disabled={isSubscriptionPending}
          />
        )}
      </Box>

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
                onVote={() => votePost(post.id)}
                voteStopPropagation
              />
            </RouterLink>
          ))}
        </Box>
      )}
    </Box>
  );
};
