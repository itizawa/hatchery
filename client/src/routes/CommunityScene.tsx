import { Box, Stack, Typography } from "../components/uiParts";
import { Link as RouterLink, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, type ReactElement } from "react";

import {
  useCommunityFeed,
  useSubscribe,
  useUnsubscribe,
  useVotePost,
  usePublicCommunities,
  useRecentWorkers,
} from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { useMarkCommunityViewed } from "../api/subscriptions.js";
import { CommunityHeader } from "../components/CommunityHeader.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import { PostCard } from "../components/PostCard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { RecentWorkersSection } from "../components/RecentWorkersSection.js";
import { ShareButton } from "../components/ShareButton.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { SubscriptionStatus } from "../components/SubscriptionStatus.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import type { Community } from "../api/communities.js";

/**
 * 最近投稿したワーカーパネル（#207）。
 * #462: useRecentWorkers は Suspense 化。ローディング/エラーは局所 QueryBoundary に委譲し、
 * コミュニティ本体（feed など）と独立して描画する。
 */
const RecentWorkersPanel = ({ slug }: { slug: string }): ReactElement => {
  const { data: recentWorkers } = useRecentWorkers(slug);
  return <RecentWorkersSection workers={recentWorkers} />;
};

/** フラットリスト行の hover スタイル（#834）。borderRadius は付けず bgcolor 変化のみ。 */
const listItemSx = {
  "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
  transition: "background-color 150ms ease-out",
} as const;

/**
 * 購読中コミュニティ訪問時に mark-viewed を自動呼び出しするエフェクト（#934）。
 * SubscriptionStatus render-prop 内で subscribed === true のときのみレンダーされ、
 * 未認証ユーザー・未購読コミュニティへの余分な API 呼び出しを防ぐ。
 */
const MarkViewedEffect = ({ slug }: { slug: string }): null => {
  const { mutate: markViewed } = useMarkCommunityViewed(slug);
  useEffect(() => {
    markViewed();
  }, [slug, markViewed]);
  return null;
};

/**
 * コミュニティが実在する場合のみレンダーされる内側コンポーネント。
 * useCommunityFeed など、コミュニティ存在を前提とするフックをここに集約する（#524）。
 * 存在しない slug の場合は CommunityScene が早期リターンしてこのコンポーネントはレンダーされない。
 * #748: vote 連打防止。#890: 押した方向のみ disabled にし、反対方向は操作可能にする。
 */
const CommunityContent = ({
  community,
  communitySlug,
}: {
  community: Community;
  communitySlug: string;
}): ReactElement => {
  const { data: posts } = useCommunityFeed(communitySlug);
  const { data: authUser } = useAuth();
  const navigate = useNavigate();

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);
  const { mutate: votePost, isPending: isVotingPost, variables: votingPostVars } = useVotePost(communitySlug);

  const isSubscriptionPending = isSubscribing || isUnsubscribing;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = community.name;

  return (
    <SubscriptionStatus communitySlug={communitySlug}>
      {(subscribed) => (
        <>
          {subscribed && <MarkViewedEffect slug={communitySlug} />}
          <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
          {/* Reddit 風ヘッダー: カバー画像＋左下に重ねた丸いアイコン＋name（#457） */}
          <CommunityHeader
            community={community}
            actions={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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

          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
            {/* 左カラム: Post 一覧（#462: useCommunityFeed は Suspense 化済みのため isLoading 分岐は不要） */}
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
                <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
                  {posts.map((post) => (
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
                          upVoteDisabled={isVotingPost && votingPostVars?.postId === post.id && votingPostVars?.direction === "up"}
                          downVoteDisabled={isVotingPost && votingPostVars?.postId === post.id && votingPostVars?.direction === "down"}
                          voteStopPropagation
                          truncateText
                          variant="list"
                          currentVote={post.my_vote ?? null}
                          postUrl={`${window.location.origin}/posts/${post.id}`}
                          onCommentClick={
                            post.comment_count
                              ? () => void navigate({ to: "/posts/$postId", params: { postId: post.id }, hash: "comments" })
                              : undefined
                          }
                        />
                      </RouterLink>
                    </Box>
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
                top: 24,
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
                {/* #462: useRecentWorkers は Suspense 化。サイドバー内の局所 QueryBoundary で
                    ローディング/エラーを分離し、ページ本体（feed など）と独立して描画する。 */}
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
          </Box>
        </Box>
        </>
      )}
    </SubscriptionStatus>
  );
};

/**
 * コミュニティページ（/communities/$slug）。
 * Reddit 風 2 カラムレイアウト（左: Post 一覧 / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0018 / Issue #370。
 * #462: usePublicCommunities・useCommunityFeed は Suspense 化（ローディング/エラーは router の QueryBoundary に委譲）。
 * useRecentWorkers はサイドバーの局所 QueryBoundary に委譲する。
 * #481: ゲストの vote 押下は guardVote で握りつぶさずログイン誘導する。
 * #524: 存在しない slug のとき「コミュニティが見つかりません」を表示する。
 * #748: vote 連打防止。#890: 押した方向のみ disabled にし、反対方向は操作可能にする。
 */
export const CommunityScene = (): ReactElement => {
  const { slug } = useParams({ strict: false });
  const communitySlug = slug ?? "";

  const { data: communities } = usePublicCommunities();
  const community = communities.find((c) => c.slug === communitySlug);

  useDocumentTitle(community ? `${community.name} - Hatchery` : undefined);

  if (!community) {
    return (
      <Box sx={{ textAlign: "center", py: 8, px: 3 }}>
        <Typography variant="h6" gutterBottom>
          コミュニティが見つかりません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          URL を確認するか、以下からコミュニティを探してください。
        </Typography>
        <RouterLink to="/communities">コミュニティを探す</RouterLink>
      </Box>
    );
  }

  return <CommunityContent community={community} communitySlug={communitySlug} />;
};
