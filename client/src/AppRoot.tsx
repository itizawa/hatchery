import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import { useCfPageViewTracking } from "./analytics/useCfPageViewTracking";
import { createQueryClient } from "./queryClient";
import { router as defaultRouter, type AppRouter } from "./router";
import { slackTheme } from "./theme";

const viewTransitionStyles = {
  "::view-transition-old(root), ::view-transition-new(root)": {
    animationDuration: "180ms",
    animationTimingFunction: "ease-out",
  },
  "::view-transition-old(root)": {
    animationName: "vt-fade-out",
  },
  "::view-transition-new(root)": {
    animationName: "vt-fade-in",
  },
  "@keyframes vt-fade-out": {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  "@keyframes vt-fade-in": {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  "@media (prefers-reduced-motion: reduce)": {
    "::view-transition-old(root), ::view-transition-new(root)": {
      animation: "none",
    },
  },
};

export interface AppRootProps {
  /** 注入するルータ（未指定なら browser history の既定ルータ）。テストで memory history を差し込める。 */
  router?: AppRouter;
}

/**
 * アプリのルート。Slack 風テーマ（ThemeProvider + CssBaseline）・サーバ状態（QueryClientProvider）・
 * ルーティング（RouterProvider）を合成する。サーバ状態は TanStack Query に集約する（ADR-0003）。
 */
export const AppRoot = ({ router = defaultRouter }: AppRootProps = {}): ReactElement => {
  // マウントごとに 1 つの QueryClient を保持する（再レンダーで作り直さない）。
  const [queryClient] = useState(createQueryClient);

  // SPA ルート遷移を Cloudflare Web Analytics へ通知する（ADR-0026 / #439）。
  // トークン未設定（window.__cfBeacon 不在）では no-op になる。
  useCfPageViewTracking(router);

  return (
    <ThemeProvider theme={slackTheme}>
      <CssBaseline />
      <GlobalStyles styles={viewTransitionStyles} />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
};
