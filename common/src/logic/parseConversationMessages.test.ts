import { describe, expect, it } from "vitest";

import { parseConversationMessages } from "./parseConversationMessages.js";

describe("parseConversationMessages (#53)", () => {
  const known = ["haru", "ken"];

  it("JSON 配列を Message[] に変換し channel を注入する", () => {
    const raw = JSON.stringify([
      { speaker: "haru", text: "やあ" },
      { speaker: "ken", text: "よろしく" },
    ]);
    expect(parseConversationMessages(raw, "zatsudan", known)).toEqual([
      { speaker: "haru", channel: "zatsudan", text: "やあ" },
      { speaker: "ken", channel: "zatsudan", text: "よろしく" },
    ]);
  });

  it("未知 speaker の項目を除外する", () => {
    const raw = JSON.stringify([
      { speaker: "haru", text: "やあ" },
      { speaker: "unknown", text: "誰?" },
    ]);
    const msgs = parseConversationMessages(raw, "zatsudan", known);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.speaker).toBe("haru");
  });

  it("空 text / 上限超過 text の項目を除外する", () => {
    const raw = JSON.stringify([
      { speaker: "haru", text: "" },
      { speaker: "ken", text: "x".repeat(281) },
      { speaker: "haru", text: "ok" },
    ]);
    expect(parseConversationMessages(raw, "zatsudan", known)).toEqual([
      { speaker: "haru", channel: "zatsudan", text: "ok" },
    ]);
  });

  it("コードフェンス（```json）で包まれた JSON も抽出できる", () => {
    const raw = "```json\n[{\"speaker\":\"haru\",\"text\":\"やあ\"}]\n```";
    expect(parseConversationMessages(raw, "zatsudan", known)).toHaveLength(1);
  });

  it("前後に説明文が混ざっていても配列を抽出できる", () => {
    const raw = "以下が会話です:\n[{\"speaker\":\"haru\",\"text\":\"やあ\"}]\nどうぞ。";
    expect(parseConversationMessages(raw, "zatsudan", known)).toHaveLength(1);
  });

  it("JSON 配列が見つからなければ例外を投げる", () => {
    expect(() => parseConversationMessages("ごめん、JSON は出せません", "zatsudan", known)).toThrow();
  });
});
