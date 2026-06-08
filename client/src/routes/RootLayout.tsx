import { Box, Drawer, Link, useMediaQuery, useTheme } from "../components/uiParts";

import { isAdmin } from "@hatchery/common";
import { Link as RouterLink, Outlet, useLocation } from "@tanstack/react-router";
import { Suspense, useEffect, useState, type ReactElement } from "react";

import { MainContentSkeleton } from "../components/MainContentSkeleton";

import { useAuth } from "../api/auth.js";
import { AppHeader } from "../components/AppHeader";
import { SidebarChannelSection } from "../components/SidebarChannelSection";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_WIDTH = 260;

/**
 * サイドバーの内容。デスクトップの恒久サイドバーとモバイルのドロワー両方で共用する。
 */
const SidebarContent = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <>
      <SidebarChannelSection />
      <Box sx={{ mt: 2 }}>
        <Link component={RouterLink} to="/office" sx={{ color: SLACK_COLORS.sidebarText }} underline="hover">
          仮想オフィス
        </Link>
      </Box>
      {user && isAdmin(user) && (
        <Box sx={{ mt: 1 }}>
          <Link component={RouterLink} to="/admin" sx={{ color: SLACK_COLORS.sidebarText }} underline="hover">
            管理画面
          </Link>
        </Box>
      )}
    </>
  );
};

/**
 * グローバルヘッダー（AppHeader）＋左サイドバー（チャンネル一覧）＋メイン領域で構成するシェル。
 * モバイル幅（md 未満）ではサイドバーをドロワー化し、ハンバーガーボタンで開閉する（#190）。
 * デスクトップ幅（md 以上）では従来どおり恒久サイドバーを横並び表示する。
 */
export const RootLayout = (): ReactElement => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // ナビゲーション（パス変化）でドロワーを自動クローズする
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
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
