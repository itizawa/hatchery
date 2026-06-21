import ArrowDownward from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpward from "@mui/icons-material/ArrowUpwardRounded";
import { Box, IconButton, Tooltip, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { VoteDirection } from "@hatchery/common";

export type { VoteDirection };

interface VoteControlProps {
  score: number;
  /** up vote の累計件数（#814）。渡した場合はこの値を表示する（score は内部用途で保持）。省略時は score を表示（後方互換）。 */
  upCount?: number;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  disabled?: boolean;
}

/**
 * up/down vote コントロール（ADR-0025 / #747）。
 * 1 つの pill コンテナ内に up・up件数・down を横並びで表示する。
 * 投票済み（up/down）は Box 背景の塗りつぶしで明示（#813）。
 * 表示数字は up vote の累計件数（up_count・#814）。down は表示数に影響しない。
 * score（ネット値）はランキング・重み付けに使われるが表示はしない。
 */
export const VoteControl = ({
  score,
  upCount,
  onVote,
  currentVote = null,
  disabled = false,
}: VoteControlProps): ReactElement => {
  // 表示する数字: upCount が渡された場合はそちらを使い、省略時は score（後方互換）。
  const displayCount = upCount ?? score;
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
        {displayCount}
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
