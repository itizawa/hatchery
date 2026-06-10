import MenuIcon from "@mui/icons-material/Menu";
import { Avatar, Box, ButtonBase, IconButton, Link, Menu, MenuItem, Skeleton, useMediaQuery } from "./uiParts";

import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { SLACK_COLORS } from "../theme.js";

const ACCOUNT_ICON_SIZE = 32;

/** ヘッダ表示／非表示アニメーションの所要時間（ms）。調整可能な定数。 */
export const HEADER_TRANSITION_MS = 200;

export interface AppHeaderProps {
  /** モバイル幅でサイドバードロワーを開くコールバック。未指定の場合はハンバーガーボタンを表示しない。 */
  onMenuOpen?: () => void;
  /** スクロール方向に応じてヘッダを隠すか。`prefers-reduced-motion` 時は無視され常に表示する。 */
  hidden?: boolean;
}

export const AppHeader = ({ onMenuOpen, hidden = false }: AppHeaderProps): ReactElement => {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // アニメーション抑制選好時は自動非表示を無効化し常時表示する
  const isHidden = hidden && !prefersReducedMotion;
  const { data: user, isPending } = useAuth();
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
        // スクロール方向に応じてふわっと出し入れする（#302）。
        // prefers-reduced-motion 時は transition を無効化し常時表示する。
        transform: isHidden ? "translateY(-100%)" : "translateY(0)",
        opacity: isHidden ? 0 : 1,
        transition: prefersReducedMotion
          ? "none"
          : `transform ${HEADER_TRANSITION_MS}ms ease, opacity ${HEADER_TRANSITION_MS}ms ease`,
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
        {isPending ? (
          <Skeleton
            variant="circular"
            width={ACCOUNT_ICON_SIZE}
            height={ACCOUNT_ICON_SIZE}
            sx={{ bgcolor: "rgba(0,0,0,0.11)" }}
            data-testid="account-skeleton"
          />
        ) : user ? (
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
                borderRadius: 1,
                p: 0.5,
                "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
              }}
            >
              <Avatar
                sx={{ width: ACCOUNT_ICON_SIZE, height: ACCOUNT_ICON_SIZE, bgcolor: SLACK_COLORS.blue, fontSize: 14 }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </Avatar>
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
        ) : (
          <Link
            component={RouterLink}
            to="/login"
            underline="none"
            sx={{
              color: SLACK_COLORS.sidebarText,
              fontWeight: "bold",
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
            }}
          >
            ログイン
          </Link>
        )}
      </Box>
    </Box>
  );
};
