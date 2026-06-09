import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { IconButton, Typography } from "./uiParts";
import { Box } from "./uiParts";
import type { ReactElement } from "react";

interface UpVoteButtonProps {
  score: number;
  onVote: () => void;
  voted?: boolean;
  disabled?: boolean;
}

/**
 * up vote ボタン。押すと score が即時反映（楽観更新）する（ADR-0020）。
 * down vote は持たない（ADR-0019）。
 */
export const UpVoteButton = ({
  score,
  onVote,
  voted = false,
  disabled = false,
}: UpVoteButtonProps): ReactElement => {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <IconButton
        aria-label="up vote"
        aria-pressed={voted}
        onClick={onVote}
        disabled={disabled}
        size="small"
        sx={{
          color: voted ? "primary.main" : "action.active",
          "&:hover": { color: "primary.main" },
        }}
      >
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" component="span" sx={{ minWidth: "1.5em", textAlign: "center" }}>
        {score}
      </Typography>
    </Box>
  );
};
