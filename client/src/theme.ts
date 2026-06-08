import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Slack 風テーマのパレット定数（ADR-0003）。
 * テストと実装で同じ値を参照できるよう公開する。ライトモード（Issue #31）の配色。
 */
export const SLACK_COLORS = {
  /** プライマリ（Slack ブルー）。ライト背景でもアクセシブルなので据え置き。 */
  blue: "#1164A3",
  /** サイドバー背景（白）。Reddit 風配色（Issue #272）。 */
  sidebar: "#FFFFFF",
  /** サイドバーテキスト色（濃色）。白背景での視認性を確保（Issue #272）。 */
  sidebarText: "#1A1A1B",
  /** メイン領域背景（薄グレー）。Reddit 風配色（Issue #272）。 */
  mainBackground: "#F6F7F8",
} as const;

/**
 * Slack 風のライトテーマ。MUI v6 + Emotion の ThemeProvider に渡す土台。
 * ライトモードに統一し、テキスト・背景の視認性を保つ（Issue #31）。MUI ライトモード既定により
 * text.primary は暗色（rgba(0,0,0,0.87)）となり、明るい背景上で視認できる。
 */
export const slackTheme: Theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: SLACK_COLORS.blue },
    background: {
      default: SLACK_COLORS.mainBackground,
    },
  },
  components: {
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: SLACK_COLORS.blue,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: "rgba(0, 0, 0, 0.6)",
          "&:hover": {
            color: "rgba(0, 0, 0, 0.87)",
          },
          "&.Mui-selected": {
            color: SLACK_COLORS.blue,
          },
        },
      },
    },
  },
});
