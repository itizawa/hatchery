import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import { createQueryClient } from "./queryClient";
import { router } from "./router";
import { slackTheme } from "./theme";

/**
 * アプリのルート。Slack 風テーマ（ThemeProvider + CssBaseline）・サーバ状態（QueryClientProvider）・
 * ルーティング（RouterProvider）を合成する。サーバ状態は TanStack Query に集約する（ADR-0003）。
 */
export const AppRoot = (): ReactElement => {
  // マウントごとに 1 つの QueryClient を保持する（再レンダーで作り直さない）。
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider theme={slackTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
};
