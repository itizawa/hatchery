import { Avatar, Box, ButtonBase, Menu, MenuItem, Typography } from "./uiParts";

import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { SLACK_COLORS } from "../theme.js";

export const UserFooter = (): ReactElement | null => {
  const { data: user, isLoading } = useAuth();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (isLoading || !user) return null;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    logout(undefined, {
      onSuccess: () => navigate({ to: "/login" }),
    });
  };

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        mt: "auto",
        pt: 2,
        borderTop: `1px solid rgba(255,255,255,0.15)`,
      }}
    >
      <ButtonBase
        onClick={handleOpen}
        aria-label="ユーザーメニュー"
        aria-controls={open ? "user-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: "100%",
          borderRadius: 1,
          p: 0.5,
          "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
        }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: SLACK_COLORS.blue, fontSize: 14 }}>
          {initial}
        </Avatar>
        <Typography
          variant="body2"
          sx={{ color: SLACK_COLORS.sidebarText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {user.displayName}
        </Typography>
      </ButtonBase>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <MenuItem component={RouterLink} to="/account" onClick={handleClose}>
          アカウント設定
        </MenuItem>
        <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
      </Menu>
    </Box>
  );
};
