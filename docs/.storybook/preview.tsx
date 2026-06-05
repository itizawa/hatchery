import React, { Suspense } from "react";
import type { Preview } from "@storybook/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { QueryClientProvider } from "@tanstack/react-query";
import { initialize, mswLoader } from "msw-storybook-addon";
import { createQueryClient } from "@hatchery/client/queryClient";
import { handlers } from "@hatchery/client/mocks";

// MSW を初期化する（Storybook 起動時にサービスワーカーを登録。Issue #108）
initialize({ onUnhandledRequest: "warn" });

// Slack 風ライトテーマ（client/src/theme.ts の slackTheme と同値・Issue #31）
// preview.tsx は Storybook 専用のエントリで client/index.ts の "UI 不可" バレルを経由しないため、
// 値を直接複製して同期する（slackTheme をライト化したら本ファイルも追従させる）。
const previewTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1164A3" },
    background: { default: "#FFFFFF", paper: "#F8F8FA" },
  },
});

const preview: Preview = {
  decorators: [
    (Story) => {
      const queryClientRef = React.useRef(createQueryClient());
      return (
        <QueryClientProvider client={queryClientRef.current}>
          <Suspense fallback={null}>
            <Story />
          </Suspense>
        </QueryClientProvider>
      );
    },
    (Story) => (
      <ThemeProvider theme={previewTheme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
