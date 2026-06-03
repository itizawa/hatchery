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

  // #4: サイドバー背景（paper）は SLACK_COLORS.sidebar と一致し、旧オーバジン色ではない。
  it("サイドバー背景（paper）が SLACK_COLORS.sidebar と一致し旧オーバジン色ではない", () => {
    expect(slackTheme.palette.background.paper).toBe(SLACK_COLORS.sidebar);
    expect(slackTheme.palette.background.paper).not.toBe("#3F0E40");
  });

  // #65: サイドバー背景色が #26334D（ダークネイビー）に変更されている。
  it("サイドバー背景色が #26334D（ダークネイビー）である", () => {
    expect(SLACK_COLORS.sidebar).toBe("#26334D");
    expect(slackTheme.palette.background.paper).toBe("#26334D");
  });

  // #65: ダーク背景上で視認できるよう ListItemButton に明色テキストの styleOverride が設定されている。
  it("MuiListItemButton の styleOverrides に明色テキスト設定が存在する", () => {
    const overrides = slackTheme.components?.MuiListItemButton?.styleOverrides?.root;
    expect(overrides).toBeDefined();
    const color = (overrides as Record<string, unknown>)?.color;
    expect(color).toBeTruthy();
  });

  // #5: メイン背景とサイドバー背景は区別できる（レイアウト境界の判別）。
  it("メイン背景とサイドバー背景が互いに異なる", () => {
    expect(slackTheme.palette.background.default).not.toBe(slackTheme.palette.background.paper);
  });

  // #6: テキスト色はライト背景上で視認できる暗色である。
  it("テキスト色がライト背景上で視認できる暗色である", () => {
    expect(slackTheme.palette.text.primary).toMatch(/rgba\(0,\s*0,\s*0/);
  });
});
