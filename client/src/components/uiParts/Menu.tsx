import MuiMenu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";

const MENU_PAPER_SX = {
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  marginTop: "8px",
};

export const Menu = ({ slotProps, ...props }: MenuProps) => (
  <MuiMenu
    slotProps={{
      ...slotProps,
      paper: {
        ...(slotProps?.paper as object | undefined),
        sx: { ...MENU_PAPER_SX, ...(slotProps?.paper as { sx?: object } | undefined)?.sx },
      },
    }}
    {...props}
  />
);
