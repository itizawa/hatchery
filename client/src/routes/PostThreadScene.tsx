import { Box, Skeleton, Typography } from "../components/uiParts";
import { useParams, Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useMemo, useRef } from "react";
import { buildCommentTree, type CommentTreeNode } from "@hatchery/common";

import {
  usePostThread,
  useVotePost,
  useVoteComment,
  usePublicCommunities,
  useSubscribe,
  useUnsubscribe,
} from "../api/communities.js";
import type { Comment } from "../api/communities.js";
import { usePostViewBeacon, useCommentImpressions } from "../api/views.js";
import { useAuth } from "../api/auth.js";
import { PostCard } from "../components/PostCard.js";
import { CommentCard } from "../components/CommentCard.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { SubscriptionStatus } from "../components/SubscriptionStatus.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

/** 右サイドバーの sticky ラッパー（md 未満で非表示）。 */
const SidebarColumn = ({ children }: { children: ReactElement }): ReactElement => (
  <Box
    sx={{
      width: 312,
      flexShrink: 0,
      display: { xs: "none", md: "block" },
      position: "sticky",
      top: 80,
    }}
  >
    {children}
  </Box>
);

/** サイドバーローディング中のスケルトン（右カラム）。 */
const SidebarSkeletonColumn = (): ReactElement => (
  <SidebarColumn>
    <Skeleton
      data-testid="community-sidebar-skeleton"
      variant="rectangular"
      height={300}
      sx={{ borderRadius: 1 }}
    />
  </SidebarColumn>
);

/**
 * 投稿スレッド左カラム上部のコミュニティパンくずりリンク。
 * usePublicCommunities は Suspense クエリのため QueryBoundary で包んで使う。
 * コミュニティが特定できない場合は null を返す。
 */
const CommunityBreadcrumb = ({ communityId }: { communityId: string }): ReactElement | null => {
  const { data: communities } = usePublicCommunities();
  const community = communities.find((c) => c.id === communityId);
  if (!community) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <RouterLink to="/communities/$slug" params={{ slug: community.slug }}>
        <Typography variant="body2" component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
          ポスト一覧
        </Typography>
      </RouterLink>
    </Box>
  );
};

/**
 * 右サイドバー（post の所属コミュニティ詳細）。
 * #462: usePublicCommunities は Suspense 化。本文（usePostThread）と独立して描画できるよう
 * このコンポーネントを局所 QueryBoundary（fallback=サイドバースケルトン）で包む。
 * 所属コミュニティを特定できない場合は右カラムごと描画しない（従来挙動を維持）。
 */
const PostThreadSidebar = ({ communityId }: { communityId: string }): ReactElement | null => {
  const { data: communities } = usePublicCommunities();
  const community = communities.find((c) => c.id === communityId);

  const { data: authUser } = useAuth();
  const communitySlug = community?.slug ?? "";
  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);

  if (!community) return null;

  const communityUrl = `${window.location.origin}/communities/${community.slug}`;

  return (
    <SidebarColumn>
      {/* #461: 購読状態は Suspense クエリの SubscriptionStatus（render-prop）で取得する。 */}
      <SubscriptionStatus communitySlug={communitySlug}>
        {(subscribed) => (
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
        )}
      </SubscriptionStatus>
    </SidebarColumn>
  );
};

/**
 * コメントのツリーノードを再帰的に CommentCard としてレンダリングする（#520）。
 * depth に応じてコネクター線 + インデントが付く。
 * commentRef ラッパー div で IntersectionObserver による閉覧計測を行う（#665）。
 */
function renderCommentTree({
  nodes,
  commentMap,
  onVote,
  commentRef,
  voteDisabled,
}: {
  nodes: CommentTreeNode[];
  commentMap: Map<string, Comment>;
  // eslint-disable-next-line max-params
  onVote: (commentId: string, direction: VoteDirection) => void;
  commentRef: (commentId: string) => (el: HTMLElement | null) => void;
  voteDisabled?: boolean;
}): ReactElement[] {
  return nodes.flatMap((node) => {
    const comment = commentMap.get(node.id);
    if (!comment) return [];

    const childElements =
      node.children.length > 0
        ? renderCommentTree({ nodes: node.children, commentMap, onVote, commentRef, voteDisabled })
        : null;

    return [
      <div key={comment.id} ref={commentRef(comment.id)}>
        <CommentCard
          comment={comment}
          onVote={(direction: VoteDirection) => onVote(comment.id, direction)}
          voteDisabled={voteDisabled}
          depth={node.depth}
          children={childElements && childElements.length > 0 ? <>{childElements}</> : null}
        />
      </div>,
    ];
  });
}

/**
 * 投稿スレッド（/posts/$postId）。
 * Reddit 風 2 カラムレイアウト（左: post 本文 + コメント / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0019 / ADR-0025 / Issue #390。
 * 投稿欄・コメント入力欄は置かない（ユーザーは書けない・ADR-0020）。
 * #462: usePostThread は Suspense 化（ローディングは router の QueryBoundary が post-thread-skeleton を表示、
 * エラーは ErrorBoundary フォールバック）。所属コミュニティ取得（usePublicCommunities）は右サイドバーの
 * 局所 QueryBoundary に委譲し、post 本文は先に描画する。
 * #481: ゲストの post / comment vote 押下は guardVote で握りつぶさずログイン誘導する。
 * #520: コメントを buildCommentTree でツリー化し Reddit 風コネクター線表示する。
 * #748: useVotePost / useVoteComment の isPending を voteDisabled に渡し連打防止。
 */
export const PostThreadScene = (): ReactElement => {
  const { postId } = useParams({ strict: false });
  const id = postId ?? "";

  const { data } = usePostThread(id);
  const { mutate: votePost, isPending: isVotingPost } = useVotePost();
  const { mutate: voteComment, isPending: isVotingComment } = useVoteComment(id);

  // 閉覧計測（#665 / ADR-0032）
  usePostViewBeacon(id);
  const { commentRef } = useCommentImpressions(id);

  const { post, comments } = data;
  const postUrl = `${window.location.origin}/posts/${post.id}`;

  useDocumentTitle(`${post.title} - Hatchery`);

  const commentSectionRef = useRef<HTMLDivElement>(null);
  const scrollToComments = () => {
    commentSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const commentTree = useMemo(
    () =>
      buildCommentTree(
        comments.map((c) => ({ id: c.id, parent_comment_id: c.parent_comment_id ?? null })),
      ),
    [comments],
  );
  const commentMap = useMemo(
    () => new Map<string, Comment>(comments.map((c) => [c.id, c])),
    [comments],
  );

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* 左カラム: post 本文 + コメント一覧 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* xs を含む全ブレークポイントで表示（モバイルでも隠さない） */}
          <QueryBoundary
            fallback={
              <Skeleton
                data-testid="community-breadcrumb-skeleton"
                variant="text"
                width={80}
                sx={{ mb: 1 }}
              />
            }
            errorFallback={() => null}
          >
            <CommunityBreadcrumb communityId={post.community_id} />
          </QueryBoundary>
          <PostCard
            post={post}
            onVote={(direction: VoteDirection) =>
              votePost({ postId: post.id, direction })
            }
            voteDisabled={isVotingPost}
            postUrl={postUrl}
            onCommentClick={comments.length > 0 ? scrollToComments : undefined}
          />

          {comments.length > 0 && (
            <Box ref={commentSectionRef} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                コメント {comments.length} 件
              </Typography>
              {renderCommentTree({
                nodes: commentTree,
                commentMap,
                // eslint-disable-next-line max-params
                onVote: (commentId, direction) => voteComment({ commentId, direction }),
                commentRef,
                voteDisabled: isVotingComment,
              })}
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

        {/* 右カラム: 所属コミュニティ詳細。取得中はスケルトン、特定できなければ右カラムごと描画しない。 */}
        <QueryBoundary fallback={<SidebarSkeletonColumn />} errorFallback={() => null}>
          <PostThreadSidebar communityId={post.community_id} />
        </QueryBoundary>
      </Box>
    </Box>
  );
};
