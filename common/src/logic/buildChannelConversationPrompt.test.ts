import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH } from "../domain/message/index.js";

import { buildChannelConversationPrompt } from "./buildChannelConversationPrompt.js";

describe("buildChannelConversationPrompt (#53)", () => {
  const employees = [
    { id: "haru", displayName: "ハル", role: "ムードメーカー", personality: "明るく場を和ませる" },
    { id: "ken", displayName: "ケン", role: null, personality: null },
  ];

  it("社員ロスター（id / displayName / role / personality）を含む", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: [],
      summary: null,
    });
    expect(prompt).toContain("haru");
    expect(prompt).toContain("ハル");
    expect(prompt).toContain("ムードメーカー");
    expect(prompt).toContain("明るく場を和ませる");
    expect(prompt).toContain("ken");
    expect(prompt).toContain("ケン");
  });

  it("チャンネル名を含む", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: [],
      summary: null,
    });
    expect(prompt).toContain("雑談");
  });

  it("JSON 配列形式と createdEmployeeId / text の出力指示を含む（#222）", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: [],
      summary: null,
    });
    expect(prompt).toContain("createdEmployeeId");
    expect(prompt).toContain("text");
    expect(prompt).toContain("JSON");
  });

  it("text の最大文字数（既定 MAX_MESSAGE_LENGTH）を指示に含む", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: [],
      summary: null,
    });
    expect(prompt).toContain(String(MAX_MESSAGE_LENGTH));
  });

  it("直近ログがあれば本文に含める", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: ["[zatsudan] haru: やあみんな"],
      summary: null,
    });
    expect(prompt).toContain("やあみんな");
  });

  it("あらすじ（summary）があれば本文に含める", () => {
    const prompt = buildChannelConversationPrompt({
      channelLabel: "雑談",
      employees,
      recentLog: [],
      summary: "これまでの経緯のあらすじ",
    });
    expect(prompt).toContain("これまでの経緯のあらすじ");
  });
});
