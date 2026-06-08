import { describe, expect, it } from "vitest";

import { parseConversationMessages } from "./parseConversationMessages.js";

describe("parseConversationMessages (#53)", () => {
  const known = ["haru", "ken"];

  it("JSON 配列を Message[] に変換し channel を注入する（#222: createdEmployeeId キー）", () => {
    const raw = JSON.stringify([
      { createdEmployeeId: "haru", text: "やあ" },
      { createdEmployeeId: "ken", text: "よろしく" },
    ]);
    expect(parseConversationMessages(raw, "zatsudan", known)).toEqual([
      { createdEmployeeId: "haru", channel: "zatsudan", text: "やあ" },
      { createdEmployeeId: "ken", channel: "zatsudan", text: "よろしく" },
    ]);
  });

  it("未知 createdEmployeeId の項目を除外する", () => {
    const raw = JSON.stringify([
      { createdEmployeeId: "haru", text: "やあ" },
      { createdEmployeeId: "unknown", text: "誰?" },
    ]);
    const msgs = parseConversationMessages(raw, "zatsudan", known);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.createdEmployeeId).toBe("haru");
  });

  it("空 text / 上限超過 text の項目を除外する", () => {
    const raw = JSON.stringify([
      { createdEmployeeId: "haru", text: "" },
      { createdEmployeeId: "ken", text: "x".repeat(281) },
      { createdEmployeeId: "haru", text: "ok" },
    ]);
    expect(parseConversationMessages(raw, "zatsudan", known)).toEqual([
      { createdEmployeeId: "haru", channel: "zatsudan", text: "ok" },
    ]);
  });

  it("コードフェンス（```json）で包まれた JSON も抽出できる", () => {
    const raw = "```json\n[{\"createdEmployeeId\":\"haru\",\"text\":\"やあ\"}]\n```";
    expect(parseConversationMessages(raw, "zatsudan", known)).toHaveLength(1);
  });

  it("前後に説明文が混ざっていても配列を抽出できる", () => {
    const raw = "以下が会話です:\n[{\"createdEmployeeId\":\"haru\",\"text\":\"やあ\"}]\nどうぞ。";
    expect(parseConversationMessages(raw, "zatsudan", known)).toHaveLength(1);
  });

  it("JSON 配列が見つからなければ例外を投げる", () => {
    expect(() => parseConversationMessages("ごめん、JSON は出せません", "zatsudan", known)).toThrow();
  });
});
