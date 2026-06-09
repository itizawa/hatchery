import { Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { Post } from "../api/communities.js";
import { UpVoteButton } from "./UpVoteButton.js";

interface PostCardProps {
  post: Post;
  onVote: () => void;
  voted?: boolean;
  voteDisabled?: boolean;
  /** up vote ボタンのクリック時に親へのイベント伝播を止める（RouterLink との共存に使用）。 */
  voteStopPropagation?: boolean;
}

/**
 * 投稿カード。タイトル・本文・author・score・up vote ボタンを表示する（ADR-0019 / ADR-0020）。
 * 投稿入力欄は持たない（ユーザーは投稿しない・ADR-0020）。
 */
export const PostCard = ({
  post,
  onVote,
  voted = false,
  voteDisabled = false,
  voteStopPropagation = false,
}: PostCardProps): ReactElement => {
  const handleVote: () => void = voteStopPropagation
    ? () => {
        // voteStopPropagation の実際のイベント止めは、UpVoteButton に onClick で委ねず
        // 上位コンポーネントから e.stopPropagation を処理する。
        // PostCard 内部では単純に onVote() を呼ぶだけ（イベント取得なし）。
        onVote();
      }
    : onVote;
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
        <Box sx={{ pt: 0.5 }}>
          <UpVoteButton score={post.score} onVote={handleVote} voted={voted} disabled={voteDisabled} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 600, mb: 0.5 }}
          >
            {post.title}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
            {post.author}
          </Typography>
          <Typography variant="body1">
            {post.text}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
