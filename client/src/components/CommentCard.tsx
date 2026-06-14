import { Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { Comment } from "../api/communities.js";
import { AuthorByline } from "./AuthorByline.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import type { VoteDirection } from "./VoteControl.js";

interface CommentCardProps {
  comment: Comment;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  voteDisabled?: boolean;
}

/**
 * コメントカード。本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * コメント入力欄は持たない（ユーザーはコメントしない・ADR-0020）。
 */
export const CommentCard = ({
  comment,
  onVote,
  currentVote = null,
  voteDisabled = false,
}: CommentCardProps): ReactElement => {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        bgcolor: "background.paper",
        mb: 1,
        ml: 2,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Box sx={{ pt: 0.25 }}>
          <VoteControl
            score={comment.score}
            onVote={onVote}
            currentVote={currentVote}
            disabled={voteDisabled}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
            <AuthorByline author={comment.author} authorWorker={comment.author_worker} />
            <PostedTime createdAt={comment.created_at} />
          </Box>
          <Typography variant="body2">
            {comment.text}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
