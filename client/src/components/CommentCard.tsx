import { Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { Comment } from "../api/communities.js";
import { UpVoteButton } from "./UpVoteButton.js";

interface CommentCardProps {
  comment: Comment;
  onVote: () => void;
  voted?: boolean;
  voteDisabled?: boolean;
}

/**
 * コメントカード。本文・author・score・up vote ボタンを表示する（ADR-0019 / ADR-0020）。
 * コメント入力欄は持たない（ユーザーはコメントしない・ADR-0020）。
 */
export const CommentCard = ({
  comment,
  onVote,
  voted = false,
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
          <UpVoteButton
            score={comment.score}
            onVote={onVote}
            voted={voted}
            disabled={voteDisabled}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
            {comment.author}
          </Typography>
          <Typography variant="body2">
            {comment.text}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
