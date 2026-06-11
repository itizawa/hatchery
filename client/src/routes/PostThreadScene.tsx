import { Box, Typography } from "../components/uiParts";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import {
  usePostThread,
  useVotePost,
  useVoteComment,
  usePublicCommunities,
  useSubscribe,
  useUnsubscribe,
} from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import { PostCard } from "../components/PostCard.js";
import { CommentCard } from "../components/CommentCard.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { useSubscriptionStatus } from "../hooks/useSubscriptionStatus.js";

/**
 * 投稿スレッド（/posts/$postId）。
 * Reddit 風 2 カラムレイアウト（左: post 本文 + コメント / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0019 / ADR-0025 / Issue #390。
 * 投稿欄・コメント入力欄は置かない（ユーザーは書けない・ADR-0020）。
 */
export const PostThreadScene = (): ReactElement => {
  const { postId } = useParams({ strict: false });
  const id = postId ?? "";

  const { data, isLoading, error } = usePostThread(id);
  const { mutate: votePost } = useVotePost();
  const { mutate: voteComment } = useVoteComment(id);

  // post.community_id から所属コミュニティを特定する（API 追加なし・#390）
  const { data: communities } = usePublicCommunities();
  const community = communities?.find((c) => c.id === data?.post.community_id);
  const communitySlug = community?.slug ?? "";

  const { data: authUser } = useAuth();
  const { subscribed } = useSubscriptionStatus(communitySlug);
  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);

  if (isLoading) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          読み込み中...
        </Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <Typography variant="body2" color="error">
          投稿の取得に失敗しました。
        </Typography>
      </Box>
    );
  }

  const { post, comments } = data;
  const postUrl = `${window.location.origin}/posts/${post.id}`;
  const communityUrl = community
    ? `${window.location.origin}/communities/${community.slug}`
    : "";

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* 左カラム: post 本文 + コメント一覧 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <PostCard
            post={post}
            onVote={(direction: VoteDirection) => votePost({ postId: post.id, direction })}
            postUrl={postUrl}
          />

          {comments.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                コメント {comments.length} 件
              </Typography>
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onVote={(direction: VoteDirection) =>
                    voteComment({ commentId: comment.id, direction })
                  }
                />
              ))}
            </Box>
          )}

          {comments.length === 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                まだコメントはありません。AI ワーカーが定時にコメントします。
              </Typography>
            </Box>
          )}
        </Box>

        {/* 右カラム: コミュニティ詳細 sticky サイドバー（md 未満で非表示・未特定時は描画しない） */}
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
              shareUrl={communityUrl}
              shareTitle={community.name}
              showSubscribe={Boolean(authUser)}
              subscribed={subscribed}
              subscriptionPending={isSubscribing || isUnsubscribing}
              onSubscribe={() => subscribe()}
              onUnsubscribe={() => unsubscribe()}
              nameLink
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
