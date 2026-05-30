import type { Preview } from "@storybook/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Slack 風ダークテーマ（ADR-0003 の slackTheme と同値）
// preview.tsx は Storybook 専用のエントリで client/index.ts の "UI 不可" バレルを経由しない
const previewTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#1164A3" },
    background: { default: "#1A1D21", paper: "#3F0E40" },
  },
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={previewTheme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
