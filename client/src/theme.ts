import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Slack 風テーマのパレット定数（ADR-0003）。
 * テストと実装で同じ値を参照できるよう公開する。ライトモード（Issue #31）の配色。
 */
export const SLACK_COLORS = {
  /** プライマリ（Slack ブルー）。ライト背景でもアクセシブルなので据え置き。 */
  blue: "#1164A3",
  /** サイドバー背景（白に近い明るいグレー）。MUI の background.paper に割り当てる。 */
  sidebar: "#F8F8FA",
  /** メイン背景（白）。 */
  background: "#FFFFFF",
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
      default: SLACK_COLORS.background,
      paper: SLACK_COLORS.sidebar,
    },
  },
});
