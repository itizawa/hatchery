import MenuIcon from "@mui/icons-material/Menu";
import { Avatar, Box, ButtonBase, IconButton, Link, Menu, MenuItem, Skeleton } from "./uiParts";

import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { useLoginModal } from "../hooks/useLoginModal.js";
import { SLACK_COLORS } from "../theme.js";

const ACCOUNT_ICON_SIZE = 32;

export interface AppHeaderProps {
  /** モバイル幅でサイドバードロワーを開くコールバック。未指定の場合はハンバーガーボタンを表示しない。 */
  onMenuOpen?: () => void;
}

export const AppHeader = ({ onMenuOpen }: AppHeaderProps): ReactElement => {
  const { data: user, isPending } = useAuth();
  const { mutate: logout } = useLogout();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    // #454: ログアウト後はゲスト向け公開ホームへ戻す（ログインモーダルは自動では開かない）。
    logout(undefined, {
      onSuccess: () => navigate({ to: "/", search: {} }),
    });
  };

  // #454: ログイン導線はページ遷移せず、現在の閲覧コンテキストを保ったままモーダルを開く。
  const handleLoginClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openLogin();
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
            // #454: 現在パスを保ったまま ?login=1 を付与してログインモーダルを開く。
            // href も /?login=1 になりリロード・新規タブでも復元可能（middle-click 互換）。
            to="."
            search={((prev: Record<string, unknown>) => ({ ...prev, login: true })) as never}
            onClick={handleLoginClick}
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
