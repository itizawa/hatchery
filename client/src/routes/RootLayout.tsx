import { Box, Link, Typography } from "../components/uiParts";

import { isAdmin } from "@hatchery/common";
import { Link as RouterLink, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { SidebarChannelSection } from "../components/SidebarChannelSection";
import { UserFooter } from "../components/UserFooter";
import { SLACK_COLORS } from "../theme.js";

export const RootLayout = (): ReactElement => {
  const { data: user } = useAuth();

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
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
        <UserFooter />
      </Box>
      <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </Box>
    </Box>
  );
};
