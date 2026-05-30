import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Slack 風テーマのパレット定数（ADR-0003）。
 * テストと実装で同じ値を参照できるよう公開する。
 */
export const SLACK_COLORS = {
  /** プライマリ（Slack ブルー）。 */
  blue: "#1164A3",
  /** サイドバー背景（Slack オーバジン）。MUI の background.paper に割り当てる。 */
  sidebar: "#3F0E40",
  /** メイン背景（暗色）。 */
  background: "#1A1D21",
} as const;

/**
 * Slack 風のダークテーマ。MUI v6 + Emotion の ThemeProvider に渡す土台。
 * 配色の本格調整・コンポーネント上書きは後続 Issue で拡張する。
 */
export const slackTheme: Theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: SLACK_COLORS.blue },
    background: {
      default: SLACK_COLORS.background,
      paper: SLACK_COLORS.sidebar,
    },
  },
});
