import { Box, Link } from "../components/uiParts";

import { isAdmin } from "@hatchery/common";
import { Link as RouterLink, Outlet } from "@tanstack/react-router";
import { Suspense, type ReactElement } from "react";

import { MainContentSkeleton } from "../components/MainContentSkeleton";

import { useAuth } from "../api/auth.js";
import { AppHeader } from "../components/AppHeader";
import { SidebarChannelSection } from "../components/SidebarChannelSection";
import { SLACK_COLORS } from "../theme.js";

/**
 * グローバルヘッダー（AppHeader）＋左サイドバー（チャンネル一覧）＋メイン領域で構成するシェル。
 */
export const RootLayout = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader />
      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        <Box
          component="nav"
          aria-label="サイドバー"
          sx={{
            width: 260,
            flexShrink: 0,
            bgcolor: SLACK_COLORS.sidebar,
            borderRight: 1,
            borderColor: "divider",
            p: 2,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
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
        </Box>
        <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default", overflow: "auto", display: "flex", flexDirection: "column" }}>
          <Suspense fallback={<MainContentSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};
