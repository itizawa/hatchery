import MenuIcon from "@mui/icons-material/Menu";
import { Avatar, Box, ButtonBase, IconButton, Link, Menu, MenuItem, Skeleton } from "./uiParts";

import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { useLoginModal } from "../hooks/useLoginModal.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { SLACK_COLORS } from "../theme.js";

const ACCOUNT_ICON_SIZE = 32;
/**
 * ヘッダー右端スロットの固定高さ（px）。
 * ログイン時のアバターボタン（Avatar 32px + ButtonBase の p: 0.5 = 上下 4px ずつ）が最も背が高く 40px。
 * これを基準スロット高にして 3 状態（ログイン / 未ログイン / ローディング）の占有高さを揃え、
 * ヘッダー総高がログイン状態に依らず一定になるようにする（#485）。
 */
const RIGHT_SLOT_HEIGHT = ACCOUNT_ICON_SIZE + 8;

export interface AppHeaderProps {
  /** モバイル幅でサイドバードロワーを開くコールバック。未指定の場合はハンバーガーボタンを表示しない。 */
  onMenuOpen?: () => void;
}

/** 認証確認中（Suspense 中）に表示するアバター型スケルトン（従来の isPending 表示と同じ見た目）。 */
const AccountSkeleton = (): ReactElement => (
  <Skeleton
    variant="circular"
    width={ACCOUNT_ICON_SIZE}
    height={ACCOUNT_ICON_SIZE}
    sx={{ bgcolor: "rgba(0,0,0,0.11)" }}
    data-testid="account-skeleton"
  />
);

/**
 * ヘッダー右端の認証状態セクション（#461）。
 * `useAuth`（useSuspenseQuery）で取得した認証状態に応じて、
 * ログイン済み → ユーザーメニュー、未ログイン → ログインモーダルを開くリンクを表示する。
 * ローディングは呼び出し側の QueryBoundary（fallback = AccountSkeleton）に委譲する。
 */
const AppHeaderAuthSection = (): ReactElement => {
  const { data: user } = useAuth();
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

  if (!user) {
    return (
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
    );
  }

  return (
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
          sx={{
            width: ACCOUNT_ICON_SIZE,
            height: ACCOUNT_ICON_SIZE,
            bgcolor: SLACK_COLORS.blue,
            fontSize: 14,
          }}
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
  );
};

export const AppHeader = ({ onMenuOpen }: AppHeaderProps): ReactElement => {
  return (
    <Box
      component="header"
      data-testid="app-header"
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
        // サイドバー⇔メインの区切り（borderRight: 1, borderColor: "divider"）と揃えた薄い境界線。
        // 以前の boxShadow: 1 は主張が強かったため borderBottom に統一する（#485）。
        borderBottom: 1,
        borderColor: "divider",
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

      <Box
        data-testid="header-right-slot"
        sx={{
          ml: "auto",
          // 右端要素（アバターボタン / ログインリンク / Skeleton）を同一の固定高さスロットに
          // 縦中央配置し、各バリアントの高さ差がヘッダー総高に波及しないようにする（#485）。
          height: RIGHT_SLOT_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {/* 認証状態の取得（Suspense）は局所的に QueryBoundary で受け、確認中は AccountSkeleton を表示する（#461）。 */}
        <QueryBoundary fallback={<AccountSkeleton />}>
          <AppHeaderAuthSection />
        </QueryBoundary>
      </Box>
    </Box>
  );
};
