import MenuIcon from "@mui/icons-material/Menu";
import { Avatar, Box, ButtonBase, IconButton, Link, Menu, MenuItem, Typography } from "./uiParts";

import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { SLACK_COLORS } from "../theme.js";

export interface AppHeaderProps {
  /** モバイル幅でサイドバードロワーを開くコールバック。未指定の場合はハンバーガーボタンを表示しない。 */
  onMenuOpen?: () => void;
}

export const AppHeader = ({ onMenuOpen }: AppHeaderProps): ReactElement => {
  const { data: user } = useAuth();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    logout(undefined, {
      onSuccess: () => navigate({ to: "/login" }),
    });
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        width: "100%",
        bgcolor: SLACK_COLORS.sidebar,
        display: "flex",
        alignItems: "center",
        px: 2,
        py: 1,
        boxShadow: 1,
      }}
    >
      {onMenuOpen && (
        <IconButton
          aria-label="メニューを開く"
          onClick={onMenuOpen}
          sx={{ color: SLACK_COLORS.sidebarText, mr: 1 }}
        >
          <MenuIcon />
        </IconButton>
      )}
      <Link
        component={RouterLink}
        to="/"
        underline="none"
        sx={{ color: SLACK_COLORS.sidebarText, fontWeight: "bold", fontSize: "1.1rem" }}
        aria-label="Hatchery"
      >
        Hatchery
      </Link>

      <Box sx={{ ml: "auto" }}>
        {user && (
          <>
            <ButtonBase
              onClick={handleOpen}
              aria-label="ユーザーメニュー"
              aria-controls={open ? "app-header-user-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderRadius: 1,
                p: 0.5,
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: SLACK_COLORS.blue, fontSize: 14 }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                variant="body2"
                sx={{ color: SLACK_COLORS.sidebarText, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {user.displayName}
              </Typography>
            </ButtonBase>
            <Menu
              id="app-header-user-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem component={RouterLink} to="/account" onClick={handleClose}>
                アカウント設定
              </MenuItem>
              <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
};
