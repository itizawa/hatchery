import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { isAdmin } from "@hatchery/common";
import { Link as RouterLink, Outlet } from "@tanstack/react-router";
import { Suspense, type ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { AddChannelForm } from "../components/AddChannelForm";
import { ChannelList } from "../components/ChannelList";
import { ChannelListSkeleton } from "../components/ChannelListSkeleton";
import { UserFooter } from "../components/UserFooter";
import { SLACK_COLORS } from "../theme.js";

/**
 * Slack 風シェル。左サイドバー（ワークスペース名 + チャンネル一覧）と
 * メイン領域（ルートの Outlet）で構成する。
 */
export const RootLayout = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
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
        }}
      >
        <Typography variant="h6" component="p" gutterBottom sx={{ color: SLACK_COLORS.sidebarText }}>
          Hatchery
        </Typography>
        <Suspense fallback={<ChannelListSkeleton />}>
          <ChannelList />
        </Suspense>
        <AddChannelForm />
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
        <UserFooter />
      </Box>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
        <Outlet />
      </Box>
    </Box>
  );
};
