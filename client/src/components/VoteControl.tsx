import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
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
 * up/down vote コントロール（ADR-0025 / #747）。
 * 1 つの pill コンテナ内に up・スコア・down を横並びで表示する。
 * 現在の投票状態（up/down/未投票）を色で区別する。
 * down 累積数は表示しない（score のみ）。
 */
export const VoteControl = ({
  score,
  onVote,
  currentVote = null,
  disabled = false,
}: VoteControlProps): ReactElement => {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        borderRadius: "999px",
        overflow: "hidden",
      }}
    >
      <IconButton
        aria-label="up vote"
        aria-pressed={currentVote === "up"}
        onClick={() => onVote("up")}
        disabled={disabled}
        size="small"
        sx={{
          color: currentVote === "up" ? "primary.main" : "action.active",
          height: 32,
          width: 32,
          borderRadius: "50%",
          "&:hover": { color: "primary.main", bgcolor: "action.hover" },
        }}
      >
        <ArrowUpward fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        component="span"
        sx={{ minWidth: "1.5em", textAlign: "center", userSelect: "none" }}
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
          height: 32,
          width: 32,
          borderRadius: "50%",
          "&:hover": { color: "error.main", bgcolor: "action.hover" },
        }}
      >
        <ArrowDownward fontSize="small" />
      </IconButton>
    </Box>
  );
};
