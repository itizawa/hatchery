import { Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type React from "react";
import type { Post } from "../api/communities.js";
import { AuthorByline } from "./AuthorByline.js";
import { VoteControl } from "./VoteControl.js";
import { ShareButton } from "./ShareButton.js";
import type { VoteDirection } from "./VoteControl.js";

interface PostCardProps {
  post: Post;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  voteDisabled?: boolean;
  /** up/down vote ボタンのクリック時に親へのイベント伝播を止め、リンクのデフォルト遷移も抑止する（RouterLink との共存に使用）。 */
  voteStopPropagation?: boolean;
  /** 共有ボタンに使う post の URL。指定時のみ ShareButton を表示する。 */
  postUrl?: string;
}

/**
 * 投稿カード。タイトル・本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * post のアクションバーに ShareButton を追加（ADR-0025）。
 * 投稿入力欄は持たない（ユーザーは投稿しない・ADR-0020）。
 */
export const PostCard = ({
  post,
  onVote,
  currentVote = null,
  voteDisabled = false,
  voteStopPropagation = false,
  postUrl,
}: PostCardProps): ReactElement => {
  const handleVoteClick = voteStopPropagation
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }
    : undefined;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
        bgcolor: "background.paper",
        mb: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Box
          sx={{ pt: 0.5 }}
          onClick={handleVoteClick}
        >
          <VoteControl
            score={post.score}
            onVote={onVote}
            currentVote={currentVote}
            disabled={voteDisabled}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 600, mb: 0.5 }}
          >
            {post.title}
          </Typography>
          <Box sx={{ mb: 1 }}>
            <AuthorByline author={post.author} authorWorker={post.author_worker} />
          </Box>
          <Typography variant="body1">
            {post.text}
          </Typography>
          {postUrl && (
            <Box sx={{ mt: 1 }}>
              <ShareButton shareUrl={postUrl} shareTitle={post.title} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
