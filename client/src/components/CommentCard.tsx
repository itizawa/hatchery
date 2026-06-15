import { Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { Comment } from "../api/communities.js";
import { AuthorByline } from "./AuthorByline.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import type { VoteDirection } from "./VoteControl.js";

/** コネクターラインの色（MUI テーマのカラーキー）。 */
const CONNECTOR_COLOR = "divider";

/** 深さ 1 段あたりのインデント幅（px）。 */
const INDENT_PER_DEPTH = 16;

/** 最大インデント深さ。これ以上深くなっても INDENT_PER_DEPTH * MAX_DEPTH 以上には広がらない。 */
export const MAX_COMMENT_DEPTH = 6;

interface CommentCardProps {
  comment: Comment;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  voteDisabled?: boolean;
  /** ネスト深さ（0 = トップレベル）。Reddit 風インデントに使う。#520。 */
  depth?: number;
  /** 子コメント（再帰表示用）。 */
  children?: ReactElement | null;
}

/**
 * コメントカード。本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * コメント入力欄は持たない（ユーザーはコメントしない・ADR-0020）。
 * #520: Reddit 風コネクター線（スレッドライン）+ 深さに応じたインデントに対応。
 */
export const CommentCard = ({
  comment,
  onVote,
  currentVote = null,
  voteDisabled = false,
  depth = 0,
  children = null,
}: CommentCardProps): ReactElement => {
  const clampedDepth = Math.min(depth, MAX_COMMENT_DEPTH);
  const indentLeft = clampedDepth * INDENT_PER_DEPTH;

  return (
    <Box
      sx={{
        pl: `${indentLeft}px`,
        position: "relative",
      }}
    >
      {/* 深さ > 0 のときコネクターライン（左縦線）を描画する。 */}
      {depth > 0 && (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `${indentLeft - 8}px`,
            top: 0,
            bottom: 0,
            width: "2px",
            bgcolor: CONNECTOR_COLOR,
            borderRadius: "1px",
          }}
        />
      )}

      {/* コメント本体 */}
      <Box
        sx={{
          py: 0.75,
          pl: depth > 0 ? 1 : 0,
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
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}
            >
              <AuthorByline author={comment.author} authorWorker={comment.author_worker} />
              <PostedTime createdAt={comment.created_at} />
            </Box>
            <Typography variant="body2">{comment.text}</Typography>
          </Box>
        </Box>
      </Box>

      {/* 子コメント */}
      {children}
    </Box>
  );
};
