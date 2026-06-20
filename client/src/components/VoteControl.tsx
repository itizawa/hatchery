import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Box, Chip, Typography } from "./uiParts";
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
 * up Chip・中央スコア・down Chip の 3 要素構成で表示する（pill 型ボタン）。
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
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Chip
        component="button"
        clickable
        icon={<ArrowUpwardIcon />}
        label=""
        aria-label="up vote"
        aria-pressed={currentVote === "up"}
        onClick={() => onVote("up")}
        disabled={disabled}
        size="small"
        sx={{
          color: currentVote === "up" ? "primary.main" : "action.active",
          borderColor: currentVote === "up" ? "primary.main" : "divider",
          bgcolor: "background.paper",
          "& .MuiChip-label": { display: "none" },
          "&:hover": { color: "primary.main" },
        }}
        variant="outlined"
      />
      <Typography
        variant="body2"
        component="span"
        sx={{ minWidth: "1.5em", textAlign: "center" }}
      >
        {score}
      </Typography>
      <Chip
        component="button"
        clickable
        icon={<ArrowDownwardIcon />}
        label=""
        aria-label="down vote"
        aria-pressed={currentVote === "down"}
        onClick={() => onVote("down")}
        disabled={disabled}
        size="small"
        sx={{
          color: currentVote === "down" ? "error.main" : "action.active",
          borderColor: currentVote === "down" ? "error.main" : "divider",
          bgcolor: "background.paper",
          "& .MuiChip-label": { display: "none" },
          "&:hover": { color: "error.main" },
        }}
        variant="outlined"
      />
    </Box>
  );
};
