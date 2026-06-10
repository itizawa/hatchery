import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Box, IconButton, Typography } from "./uiParts";
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
 * up/down vote コントロール（ADR-0025）。
 * up 矢印・中央スコア・down 矢印を横並びで表示する。
 * 現在の投票状態（up/down/未投票）を視覚的に区別する。
 * down 累積数は表示しない（score のみ）。
 */
export const VoteControl = ({
  score,
  onVote,
  currentVote = null,
  disabled = false,
}: VoteControlProps): ReactElement => {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <IconButton
        aria-label="up vote"
        aria-pressed={currentVote === "up"}
        onClick={() => onVote("up")}
        disabled={disabled}
        size="small"
        sx={{
          color: currentVote === "up" ? "primary.main" : "action.active",
          "&:hover": { color: "primary.main" },
        }}
      >
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        component="span"
        sx={{ minWidth: "1.5em", textAlign: "center" }}
      >
        {score}
      </Typography>
      <IconButton
        aria-label="down vote"
        aria-pressed={currentVote === "down"}
        onClick={() => onVote("down")}
        disabled={disabled}
        size="small"
        sx={{
          color: currentVote === "down" ? "error.main" : "action.active",
          "&:hover": { color: "error.main" },
        }}
      >
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
