import { describe, expect, it } from "vitest";

import { SLACK_COLORS, slackTheme } from "./theme";

// 受け入れ条件（Issue #31: Slack 風UI のライトモード化）。
describe("slackTheme", () => {
  // #1: ライトモードの MUI テーマであること。
  it("ライトモードの MUI テーマである", () => {
    expect(slackTheme.palette.mode).toBe("light");
  });

  // #2: プライマリ（Slack ブルー）は据え置き。
  it("プライマリカラーが Slack 風ブルーである", () => {
    expect(slackTheme.palette.primary.main).toBe(SLACK_COLORS.blue);
  });

  // #272: メイン背景は薄グレー（mainBackground）を使用する。
  it("メイン背景色が SLACK_COLORS.mainBackground（薄グレー）である", () => {
    expect(slackTheme.palette.background.default).toBe(SLACK_COLORS.mainBackground);
    expect(slackTheme.palette.background.default).not.toBe("#1A1D21");
  });

  // #6: テキスト色はライト背景上で視認できる暗色である。
  it("テキスト色がライト背景上で視認できる暗色である", () => {
    expect(slackTheme.palette.text.primary).toMatch(/rgba\(0,\s*0,\s*0/);
  });

  // #272: サイドバー背景色が白（#FFFFFF）に変更されている（Reddit 風配色）。
  it("SLACK_COLORS.sidebar が #FFFFFF（白）である", () => {
    expect(SLACK_COLORS.sidebar).toBe("#FFFFFF");
  });

  // #272: サイドバーテキスト色が濃色（#1A1A1B）に変更されている（白背景での視認性）。
  it("SLACK_COLORS.sidebarText が #1A1A1B（濃色）である", () => {
    expect(SLACK_COLORS.sidebarText).toBe("#1A1A1B");
  });

  // #272: メイン領域背景色（薄グレー）が定義されている。
  it("SLACK_COLORS.mainBackground が #F6F7F8（薄グレー）である", () => {
    expect(SLACK_COLORS.mainBackground).toBe("#F6F7F8");
  });

  // グローバルな Paper サーフェスがサイドバー旧色に汚染されていない。
  it("background.paper がサイドバー旧色（#26334D）に汚染されていない", () => {
    expect(slackTheme.palette.background.paper).not.toBe("#26334D");
  });
});
