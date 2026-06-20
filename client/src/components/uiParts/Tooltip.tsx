import MuiTooltip, { TooltipProps } from "@mui/material/Tooltip";

export const Tooltip = ({ arrow = true, ...props }: TooltipProps) => (
  <MuiTooltip arrow={arrow} {...props} />
);
