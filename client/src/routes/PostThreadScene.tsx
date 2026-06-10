import { Box, Typography } from "../components/uiParts";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { usePostThread, useVotePost, useVoteComment } from "../api/communities.js";
import { PostCard } from "../components/PostCard.js";
import { CommentCard } from "../components/CommentCard.js";
import type { VoteDirection } from "../components/VoteControl.js";

/**
 * 投稿スレッド（/posts/$postId）。
 * post 本文 + コメント（フラット）を表示する（ADR-0019 / ADR-0025）。
 * 投稿欄・コメント入力欄は置かない（ユーザーは書けない・ADR-0020）。
 */
export const PostThreadScene = (): ReactElement => {
  const { postId } = useParams({ strict: false });
  const id = postId ?? "";

  const { data, isLoading, error } = usePostThread(id);
  const { mutate: votePost } = useVotePost();
  const { mutate: voteComment } = useVoteComment(id);

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

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
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
  );
};
