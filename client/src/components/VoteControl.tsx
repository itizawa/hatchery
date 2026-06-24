import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import { Box, IconButton, Tooltip, Typography } from "./uiParts";
import { SLACK_COLORS } from "../theme";
import type { ReactElement } from "react";
import type { VoteDirection } from "@hatchery/common";

export type { VoteDirection };

interface VoteControlProps {
  score: number;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  upDisabled?: boolean;
  downDisabled?: boolean;
}

/**
 * up/down vote コントロール（ADR-0025 / #747）。
 * 1 つの pill コンテナ内に up・ネットスコア・down を横並びで表示する。
 * 投票済み（up/down）は Box 背景の塗りつぶしで明示（#813）。
 * 配色は Reddit 準拠: up=赤（#FF4500）/ down=青（#7193FF）（#854）。
 * アイコンは MUI ArrowUpwardRounded / ArrowDownwardRounded（#912）。
 * 表示数字は up − down のネットスコア（score・#856）。負値も表示する。
 * #890: upDisabled / downDisabled で方向別に disabled を制御する。
 */
export const VoteControl = ({
  score,
  onVote,
  currentVote = null,
  upDisabled = false,
  downDisabled = false,
}: VoteControlProps): ReactElement => {
  const displayCount = score;
  const voted = currentVote ?? "none";
  const isVoted = currentVote !== null;

  const bgColor =
    currentVote === "up"
      ? SLACK_COLORS.voteUp
      : currentVote === "down"
        ? SLACK_COLORS.voteDown
        : "transparent";

  return (
    <Box
      data-voted={voted}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        borderRadius: "999px",
        overflow: "hidden",
        bgcolor: bgColor,
        color: isVoted ? "primary.contrastText" : "inherit",
      }}
    >
      <Tooltip title="高評価">
        <span>
          <IconButton
            aria-label="up vote"
            aria-pressed={currentVote === "up"}
            data-color-state={isVoted ? (currentVote === "up" ? "selected" : "unselected") : "unvoted"}
            onClick={() => onVote("up")}
            disabled={upDisabled}
            size="small"
            sx={{
              color: isVoted ? (currentVote === "up" ? "inherit" : SLACK_COLORS.voteDimmed) : "action.active",
              height: 32,
              width: 32,
              borderRadius: "50%",
              "&:hover": {
                color: isVoted ? "inherit" : SLACK_COLORS.voteUp,
                bgcolor: isVoted ? SLACK_COLORS.voteHoverOverlay : "action.hover",
              },
            }}
          >
            <ArrowUpwardRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="body2"
        component="span"
        sx={{ minWidth: "1.5em", textAlign: "center", userSelect: "none" }}
      >
        {displayCount}
      </Typography>
      <Tooltip title="低評価">
        <span>
          <IconButton
            aria-label="down vote"
            aria-pressed={currentVote === "down"}
            data-color-state={isVoted ? (currentVote === "down" ? "selected" : "unselected") : "unvoted"}
            onClick={() => onVote("down")}
            disabled={downDisabled}
            size="small"
            sx={{
              color: isVoted ? (currentVote === "down" ? "inherit" : SLACK_COLORS.voteDimmed) : "action.active",
              height: 32,
              width: 32,
              borderRadius: "50%",
              "&:hover": {
                color: isVoted ? "inherit" : SLACK_COLORS.voteDown,
                bgcolor: isVoted ? SLACK_COLORS.voteHoverOverlay : "action.hover",
              },
            }}
          >
            <ArrowDownwardRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
