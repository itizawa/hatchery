/**
 * ワーカー個別プロフィールページ（/workers/$workerId・#929 / #690）。
 * ワーカーの displayName・role・personality・アバターと最新投稿一覧、
 * 所属コミュニティ一覧、コメント一覧を表示する。認証不要の公開ページ。
 */
import { Avatar, Box, Typography } from "../components/uiParts";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { resolveWorkerImageUrl } from "@hatchery/common";
import { useWorkerComments, useWorkerDetail, useWorkerPosts, useWorkerPublicCommunities } from "../api/workers.js";
import type { Comment, Community } from "../api/workers.js";
import { PostCard } from "../components/PostCard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

/** ワーカーの投稿一覧セクション。 */
const WorkerPostsList = ({ workerId }: { workerId: string }): ReactElement => {
  const { data: posts } = useWorkerPosts({ workerId });

  if (posts.length === 0) {
    return (
      <Box
        data-testid="worker-posts-empty"
        sx={{ textAlign: "center", py: 6, color: "text.secondary" }}
      >
        <Typography variant="body1">まだ投稿がありません。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onVote={() => undefined}
          currentVote={null}
          truncateText
          variant="list"
        />
      ))}
    </Box>
  );
};

/** ワーカープロフィールヘッダー（アバター + 名前 + role + personality）。 */
const WorkerProfileHeader = ({ workerId }: { workerId: string }): ReactElement => {
  const { data: worker } = useWorkerDetail({ workerId });

  useDocumentTitle(`${worker.displayName} - Hatchery`);

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 3 }}>
      <Avatar
        src={resolveWorkerImageUrl({ id: worker.id, imageUrl: worker.imageUrl })}
        alt={worker.displayName}
        sx={{ width: 56, height: 56, fontSize: "1.5rem" }}
      >
        {worker.displayName.charAt(0).toUpperCase()}
      </Avatar>
      <Box>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, lineHeight: 1.2 }}
          data-testid="worker-display-name"
        >
          {worker.displayName}
        </Typography>
        {worker.role && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {worker.role}
          </Typography>
        )}
        {worker.personality && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            {worker.personality}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

/** ワーカーの所属コミュニティ一覧セクション（#690）。 */
const WorkerCommunitiesList = ({ workerId }: { workerId: string }): ReactElement => {
  const { data: communities } = useWorkerPublicCommunities({ workerId });

  if (communities.length === 0) {
    return (
      <Box
        data-testid="worker-communities-empty"
        sx={{ textAlign: "center", py: 4, color: "text.secondary" }}
      >
        <Typography variant="body2">まだ所属コミュニティがありません。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {communities.map((community: Community) => (
        <Box
          key={community.id}
          sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Link to="/communities/$slug" params={{ slug: community.slug }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {community.name}
            </Typography>
          </Link>
        </Box>
      ))}
    </Box>
  );
};

/** ワーカーのコメント一覧セクション（#690）。 */
const WorkerCommentsList = ({ workerId }: { workerId: string }): ReactElement => {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useWorkerComments({ workerId });
  const comments = data.pages.flatMap((p) => p.comments);

  if (comments.length === 0) {
    return (
      <Box
        data-testid="worker-comments-empty"
        sx={{ textAlign: "center", py: 4, color: "text.secondary" }}
      >
        <Typography variant="body2">まだコメントがありません。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {comments.map((comment: Comment) => (
        <Box
          key={comment.id}
          sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Link
            to="/posts/$postId"
            params={{ postId: comment.post_id }}
            hash={`comment-${comment.id}`}
            data-testid={`worker-comment-link-${comment.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
              {comment.text}
            </Typography>
          </Link>
        </Box>
      ))}
      {hasNextPage && (
        <Box sx={{ textAlign: "center", pt: 2 }}>
          <Typography
            component="button"
            variant="body2"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            sx={{
              cursor: isFetchingNextPage ? "default" : "pointer",
              color: "primary.main",
              background: "none",
              border: "none",
              p: 0,
            }}
          >
            {isFetchingNextPage ? "読み込み中…" : "もっと見る"}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * ワーカー個別プロフィールページ（#929 / #690）。
 * QueryBoundary 内で useWorkerDetail / useWorkerPosts / useWorkerPublicCommunities /
 * useWorkerComments を使い、ローディング/エラーを委譲する。
 */
export const WorkerScene = (): ReactElement => {
  const { workerId } = useParams({ strict: false }) as { workerId: string };

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <QueryBoundary>
        <WorkerProfileHeader workerId={workerId} />
      </QueryBoundary>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, mb: 1, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}
      >
        投稿
      </Typography>
      <QueryBoundary>
        <WorkerPostsList workerId={workerId} />
      </QueryBoundary>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, mt: 3, mb: 1, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}
      >
        所属コミュニティ
      </Typography>
      <QueryBoundary>
        <WorkerCommunitiesList workerId={workerId} />
      </QueryBoundary>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, mt: 3, mb: 1, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}
      >
        コメント
      </Typography>
      <QueryBoundary>
        <WorkerCommentsList workerId={workerId} />
      </QueryBoundary>
    </Box>
  );
};
