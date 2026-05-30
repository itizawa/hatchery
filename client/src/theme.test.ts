import { describe, expect, it } from "vitest";

import { SLACK_COLORS, slackTheme } from "./theme";

// 受け入れ条件 #1: Slack 風テーマ（ThemeProvider の土台）。
describe("slackTheme", () => {
  it("ダークモードの MUI テーマである", () => {
    expect(slackTheme.palette.mode).toBe("dark");
  });

  it("プライマリカラーが Slack 風ブルーである", () => {
    expect(slackTheme.palette.primary.main).toBe(SLACK_COLORS.blue);
  });

  it("メイン背景色が規定の暗色である", () => {
    expect(slackTheme.palette.background.default).toBe(SLACK_COLORS.background);
  });

  it("サイドバー背景（paper）が Slack 風オーバジン色である", () => {
    expect(slackTheme.palette.background.paper).toBe(SLACK_COLORS.sidebar);
  });
});
