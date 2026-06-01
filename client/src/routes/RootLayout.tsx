import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { AddChannelForm } from "../components/AddChannelForm";
import { ChannelList } from "../components/ChannelList";

/**
 * Slack 風シェル。左サイドバー（ワークスペース名 + チャンネル一覧）と
 * メイン領域（ルートの Outlet）で構成する。
 */
export const RootLayout = (): ReactElement => (
  <Box sx={{ display: "flex", minHeight: "100vh" }}>
    <Box
      component="nav"
      aria-label="サイドバー"
      sx={{
        width: 260,
        flexShrink: 0,
        bgcolor: "background.paper",
        color: "text.primary",
        borderRight: 1,
        borderColor: "divider",
        p: 2,
      }}
    >
      <Typography variant="h6" component="p" gutterBottom>
        Hatchery
      </Typography>
      <ChannelList />
      <AddChannelForm />
      <Box sx={{ mt: 2 }}>
        <Link component={RouterLink} to="/settings" color="inherit" underline="hover">
          設定
        </Link>
      </Box>
    </Box>
    <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
      <Outlet />
    </Box>
  </Box>
);
