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

  // #3: メイン背景はライト用の明るい色で、旧ダーク色ではない。
  it("メイン背景色がライト用の明るい色である（旧ダーク色ではない）", () => {
    expect(slackTheme.palette.background.default).toBe(SLACK_COLORS.background);
    expect(slackTheme.palette.background.default).not.toBe("#1A1D21");
  });

  // #6: テキスト色はライト背景上で視認できる暗色である。
  it("テキスト色がライト背景上で視認できる暗色である", () => {
    expect(slackTheme.palette.text.primary).toMatch(/rgba\(0,\s*0,\s*0/);
  });

  // #65: サイドバー背景色が #26334D（ダークネイビー）に変更されている。
  it("SLACK_COLORS.sidebar が #26334D（ダークネイビー）である", () => {
    expect(SLACK_COLORS.sidebar).toBe("#26334D");
  });

  // #65: サイドバーテキスト色が白（#FFFFFF）として定義されている。
  it("SLACK_COLORS.sidebarText が #FFFFFF（白）である", () => {
    expect(SLACK_COLORS.sidebarText).toBe("#FFFFFF");
  });

  // #65: グローバルな Paper サーフェスがサイドバー色に汚染されていない（background.paper はデフォルト白）。
  it("background.paper がサイドバー暗色（#26334D）に汚染されていない", () => {
    expect(slackTheme.palette.background.paper).not.toBe("#26334D");
  });
});
