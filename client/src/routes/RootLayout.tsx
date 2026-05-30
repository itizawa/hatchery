import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

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
        color: "common.white",
        p: 2,
      }}
    >
      <Typography variant="h6" component="p" gutterBottom>
        Hatchery
      </Typography>
      <ChannelList />
    </Box>
    <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
      <Outlet />
    </Box>
  </Box>
);
