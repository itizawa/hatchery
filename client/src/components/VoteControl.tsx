import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import { Box, IconButton, Tooltip, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { VoteDirection } from "@hatchery/common";

export type { VoteDirection };

interface VoteControlProps {
  score: number;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  disabled?: boolean;
}

/**
 * up/down vote コントロール（ADR-0025 / #747）。
 * 1 つの pill コンテナ内に up・スコア・down を横並びで表示する。
 * 投票済み（up/down）は Box 背景の塗りつぶしで明示（#813）。
 * down 累積数は表示しない（score のみ）。
 */
export const VoteControl = ({
  score,
  onVote,
  currentVote = null,
  disabled = false,
}: VoteControlProps): ReactElement => {
  const voted = currentVote ?? "none";
  const isVoted = currentVote !== null;

  return (
    <Box
      data-voted={voted}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        borderRadius: "999px",
        overflow: "hidden",
        bgcolor:
          currentVote === "up"
            ? "primary.main"
            : currentVote === "down"
              ? "error.main"
              : "transparent",
        color: isVoted ? "primary.contrastText" : "inherit",
      }}
    >
      <Tooltip title="高評価">
        <span>
          <IconButton
            aria-label="up vote"
            aria-pressed={currentVote === "up"}
            onClick={() => onVote("up")}
            disabled={disabled}
            size="small"
            sx={{
              color: isVoted ? "inherit" : currentVote === "up" ? "primary.main" : "action.active",
              height: 32,
              width: 32,
              borderRadius: "50%",
              "&:hover": {
                color: isVoted ? "inherit" : "primary.main",
                bgcolor: isVoted ? "rgba(255,255,255,0.15)" : "action.hover",
              },
            }}
          >
            <ArrowUpward fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="body2"
        component="span"
        sx={{ minWidth: "1.5em", textAlign: "center", userSelect: "none" }}
      >
        {score}
      </Typography>
      <Tooltip title="低評価">
        <span>
          <IconButton
            aria-label="down vote"
            aria-pressed={currentVote === "down"}
            onClick={() => onVote("down")}
            disabled={disabled}
            size="small"
            sx={{
              color: isVoted ? "inherit" : currentVote === "down" ? "error.main" : "action.active",
              height: 32,
              width: 32,
              borderRadius: "50%",
              "&:hover": {
                color: isVoted ? "inherit" : "error.main",
                bgcolor: isVoted ? "rgba(255,255,255,0.15)" : "action.hover",
              },
            }}
          >
            <ArrowDownward fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
