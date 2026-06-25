/**
 * ワーカー個別プロフィールページ（/workers/$workerId・#929）。
 * ワーカーの avatar / role / personality と最新投稿一覧を表示する。認証不要の公開ページ。
 */
import { Avatar, Box, Typography } from "../components/uiParts";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import type { ReactElement } from "react";

import { useParams, useNavigate } from "@tanstack/react-router";
import type { Worker } from "@hatchery/common";
import { resolveWorkerImageUrl } from "@hatchery/common";

import { useWorkerDetail, useWorkerPosts } from "../api/workers.js";
import type { Post } from "../api/posts.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { PostCard } from "../components/PostCard.js";
import { useVotePost } from "../api/votes.js";

/** ワーカー情報ヘッダー（avatar・displayName・role・personality）。 */
const WorkerHeader = ({ worker }: { worker: Worker }): ReactElement => (
  <Box sx={{ display: "flex", gap: 3, mb: 4, alignItems: "flex-start" }}>
    <Avatar
      src={resolveWorkerImageUrl({ id: worker.id, imageUrl: worker.imageUrl })}
      alt={worker.displayName}
      sx={{ width: 80, height: 80, fontSize: "2rem" }}
    >
      {worker.displayName.charAt(0).toUpperCase()}
    </Avatar>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {worker.displayName}
      </Typography>
      {worker.role && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {worker.role}
        </Typography>
      )}
      {worker.personality && (
        <Typography variant="body2" color="text.secondary">
          {worker.personality}
        </Typography>
      )}
    </Box>
  </Box>
);

/** 投稿リスト（Suspense 内）。 */
const WorkerPostsList = ({ workerId }: { workerId: string }): ReactElement => {
  const { data: posts } = useWorkerPosts(workerId);
  const { mutate: votePost } = useVotePost();
  const navigate = useNavigate();

  if (posts.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
        <Typography variant="body1">まだ投稿がありません。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {posts.map((post: Post) => (
        <PostCard
          key={post.id}
          post={post}
          onVote={(direction) => votePost({ postId: post.id, direction })}
          truncateText
          variant="list"
          onCommentClick={() => { void navigate({ to: "/posts/$postId", params: { postId: post.id } }); }}
        />
      ))}
    </Box>
  );
};

/** ワーカー詳細本体（Suspense 内）。 */
const WorkerContent = ({ workerId }: { workerId: string }): ReactElement => {
  const { data: worker } = useWorkerDetail(workerId);
  useDocumentTitle(`${worker.displayName} - Hatchery`);

  return (
    <>
      <WorkerHeader worker={worker} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <PersonRoundedIcon sx={{ color: "text.secondary", fontSize: "1rem" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary" }}>
          最近の投稿
        </Typography>
      </Box>
      <WorkerPostsList workerId={workerId} />
    </>
  );
};

/** ワーカー個別プロフィールページ（#929）。 */
export const WorkerScene = (): ReactElement => {
  const { workerId } = useParams({ strict: false }) as { workerId: string };

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <WorkerContent workerId={workerId} />
    </Box>
  );
};
