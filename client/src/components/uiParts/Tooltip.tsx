import MuiTooltip from "@mui/material/Tooltip";
import type { TooltipProps } from "@mui/material/Tooltip";

export const Tooltip = ({ arrow = true, ...props }: TooltipProps) => (
  <MuiTooltip arrow={arrow} {...props} />
);
