import { Box, Divider, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from "../components/uiParts";

import { isAdmin } from "@hatchery/common";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { Link as RouterLink, Outlet, useLocation } from "@tanstack/react-router";
import { Suspense, useEffect, useState, type ReactElement } from "react";

import { MainContentSkeleton } from "../components/MainContentSkeleton";
import { useHideOnScroll } from "../hooks/useHideOnScroll.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

import { useAuth } from "../api/auth.js";
import { AppHeader } from "../components/AppHeader";
import { SidebarCommunitySection } from "../components/SidebarCommunitySection";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_WIDTH = 260;
const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/**
 * サイドバーの内容。デスクトップの恒久サイドバーとモバイルのドロワー両方で共用する。
 */
const SidebarContent = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <>
      <SidebarCommunitySection />
      <Divider sx={{ my: 1 }} />
      <List dense>
        {user && isAdmin(user) && (
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/admin" sx={{ color: SLACK_COLORS.sidebarText }}>
              <ListItemIcon sx={SIDEBAR_ICON_SX}>
                <AdminPanelSettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="管理画面" />
            </ListItemButton>
          </ListItem>
        )}
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
  // スクロール方向に応じてヘッダを出し入れする（#302）
  const { hidden: headerHidden, onScroll: onMainScroll } = useHideOnScroll();

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
    <Box
      data-testid="root-layout-outer"
      sx={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", maxWidth: "100%", overflowX: "hidden" }}
    >
      <AppHeader onMenuOpen={isMobile ? () => setDrawerOpen(true) : undefined} hidden={headerHidden} />
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
              sx={{ display: "flex", flexDirection: "column", height: "100%", width: SIDEBAR_WIDTH }}
            >
              <SidebarContent />
            </Box>
          </Drawer>
        )}

        {/* デスクトップ: 恒久サイドバー */}
        {!isMobile && (
          <Box
            component="nav"
            aria-label="サイドバー"
            sx={sidebarStyles}
          >
            <SidebarContent />
          </Box>
        )}

        <Box
          component="main"
          onScroll={onMainScroll}
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
      </Box>
    </Box>
  );
};
