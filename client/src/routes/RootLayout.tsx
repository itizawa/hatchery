import {
  Box,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "../components/uiParts";

import { isAdmin } from "@hatchery/common";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import DescriptionIcon from "@mui/icons-material/DescriptionRounded";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsRounded";
import HomeIcon from "@mui/icons-material/HomeRounded";
import InfoIcon from "@mui/icons-material/InfoRounded";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTipRounded";
import { Link as RouterLink, Outlet, useLocation } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState, type ReactElement } from "react";

import { MainContentSkeleton } from "../components/MainContentSkeleton";
import { ScrollToTopButton } from "../components/ScrollToTopButton";
import { useIsMobile } from "../hooks/useIsMobile.js";

import { useAuth } from "../api/auth.js";
import { AppHeader } from "../components/AppHeader";
import { QueryBoundary } from "../components/QueryBoundary";
import { SidebarCommunitySection } from "../components/SidebarCommunitySection";
import { SubscribedCommunitiesSection } from "../components/SubscribedCommunitiesSection";
import { ExternalLinkProvider } from "../hooks/useExternalLink.js";
import { InstallPromptProvider } from "../hooks/useInstallPrompt.js";
import { InstallSnackbar } from "../components/InstallSnackbar.js";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_WIDTH = 260;
const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/** Reddit 風ナビゲーション項目の共通スタイル（角丸 + アクティブ時グレー背景）。 */
const navItemSx = {
  color: SLACK_COLORS.sidebarText,
  borderRadius: 2,
  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "action.selected" },
} as const;

/**
 * サイドバー最上部の Reddit 風グローバルナビゲーション（#435）。
 * ホーム（/）。#1067: 人気（/popular）はホームに統合されたため撤去。
 * 現在ルートに一致する項目をグレー背景でハイライトする。
 */
const SidebarGlobalNav = (): ReactElement => {
  const { pathname } = useLocation();
  const isHomeActive = pathname === "/";
  const isRankingActive = pathname === "/ranking";

  return (
    <List dense>
      <ListItem disablePadding>
        <ListItemButton
          component={RouterLink}
          to="/"
          selected={isHomeActive}
          aria-current={isHomeActive ? "page" : undefined}
          sx={navItemSx}
        >
          <ListItemIcon sx={SIDEBAR_ICON_SX}>
            <HomeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="ホーム" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton
          component={RouterLink}
          to="/ranking"
          selected={isRankingActive}
          aria-current={isRankingActive ? "page" : undefined}
          sx={navItemSx}
        >
          <ListItemIcon sx={SIDEBAR_ICON_SX}>
            <EmojiEventsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="ランキング" />
        </ListItemButton>
      </ListItem>
    </List>
  );
};

/**
 * サイドバーの内容。デスクトップの恒久サイドバーとモバイルのドロワー両方で共用する。
 */
const SidebarContent = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <>
      <SidebarGlobalNav />
      <Divider sx={{ my: 1 }} />
      <SubscribedCommunitiesSection />
      <SidebarCommunitySection />
      {user && isAdmin(user) && (
        <>
          <Divider sx={{ my: 1 }} />
          <List dense>
            <ListItem disablePadding>
              <ListItemButton
                component={RouterLink}
                to="/admin"
                sx={{ color: SLACK_COLORS.sidebarText }}
              >
                <ListItemIcon sx={SIDEBAR_ICON_SX}>
                  <AdminPanelSettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="管理画面" />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}
      {/* リーガルリンク（#484）＋紹介ページ（#1056）。全ユーザー（未ログイン含む）がいつでも参照できるよう常時表示する。 */}
      <Divider sx={{ my: 1 }} />
      <List dense>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/about" sx={{ color: SLACK_COLORS.sidebarText }}>
            <ListItemIcon sx={SIDEBAR_ICON_SX}>
              <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Hatcheryとは？" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/terms" sx={{ color: SLACK_COLORS.sidebarText }}>
            <ListItemIcon sx={SIDEBAR_ICON_SX}>
              <DescriptionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="利用規約" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/privacy" sx={{ color: SLACK_COLORS.sidebarText }}>
            <ListItemIcon sx={SIDEBAR_ICON_SX}>
              <PrivacyTipIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="プライバシーポリシー" />
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );
};

/**
 * グローバルヘッダー（AppHeader）＋左サイドバー（コミュニティ一覧）＋メイン領域で構成するシェル。
 * Reddit 風 UI（ADR-0018）。モバイル幅（md 未満）ではサイドバーをドロワー化し、
 * ハンバーガーボタンで開閉する（#190）。
 */
export const RootLayout = (): ReactElement => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  // ナビゲーション（パス変化）またはモバイル→デスクトップ切り替わりでドロワーを自動クローズする
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [isMobile]);

  const sidebarStyles = {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
    bgcolor: SLACK_COLORS.sidebar,
    borderRight: 1,
    borderColor: "divider",
    p: 2,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  } as const;

  return (
    <ExternalLinkProvider>
    <InstallPromptProvider>
    <Box
      data-testid="root-layout-outer"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <AppHeader onMenuOpen={isMobile ? () => setDrawerOpen(true) : undefined} />
      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        {/* モバイル: 一時的なドロワー */}
        {isMobile && (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                ...sidebarStyles,
                boxSizing: "border-box",
              },
            }}
          >
            <Box
              component="nav"
              aria-label="サイドバー"
              data-testid="mobile-sidebar-nav"
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
              }}
            >
              {/* SidebarContent は useAuth（useSuspenseQuery）を使うため Suspense 祖先が必要（#461）。 */}
              <QueryBoundary fallback={null}>
                <SidebarContent />
              </QueryBoundary>
            </Box>
          </Drawer>
        )}

        {/* デスクトップ: 恒久サイドバー */}
        {!isMobile && (
          <Box component="nav" aria-label="サイドバー" sx={sidebarStyles}>
            {/* SidebarContent は useAuth（useSuspenseQuery）を使うため Suspense 祖先が必要（#461）。 */}
            <QueryBoundary fallback={null}>
              <SidebarContent />
            </QueryBoundary>
          </Box>
        )}

        <Box
          component="main"
          ref={mainRef}
          data-scroll-restoration-id="main-content"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            bgcolor: "background.default",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Suspense fallback={<MainContentSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
        <ScrollToTopButton key={location.pathname} scrollContainerRef={mainRef} />
      </Box>
    </Box>
    <InstallSnackbar />
    </InstallPromptProvider>
    </ExternalLinkProvider>
  );
};
