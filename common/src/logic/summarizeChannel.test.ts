import { describe, expect, it } from "vitest";

import type { MessageRecord } from "../domain/message/index.js";

import { buildSummaryPrompt, selectMessagesForDay } from "./summarizeChannel.js";

const mk = (id: string, iso: string): MessageRecord => ({
  id,
  speaker: "haru",
  channel: "zatsudan",
  text: "t",
  createdAt: new Date(iso),
  order: 0,
});

describe("selectMessagesForDay (#53)", () => {
  it("指定日（ローカル日）のメッセージのみ返す", () => {
    const msgs = [
      mk("a", "2026-06-06T00:00:00"),
      mk("b", "2026-06-06T23:59:59"),
      mk("c", "2026-06-05T23:59:59"),
      mk("d", "2026-06-07T00:00:00"),
    ];
    const day = new Date("2026-06-06T12:00:00");
    expect(selectMessagesForDay(msgs, day).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("該当が無ければ空配列を返す", () => {
    const msgs = [mk("c", "2026-06-05T10:00:00")];
    expect(selectMessagesForDay(msgs, new Date("2026-06-06T12:00:00"))).toEqual([]);
  });

  it("入力配列を破壊しない", () => {
    const msgs = [mk("a", "2026-06-06T10:00:00")];
    const before = msgs.length;
    selectMessagesForDay(msgs, new Date("2026-06-06T12:00:00"));
    expect(msgs).toHaveLength(before);
  });
});

describe("buildSummaryPrompt (#53)", () => {
  it("チャンネル名・既存あらすじ・当日メッセージを含む", () => {
    const prompt = buildSummaryPrompt({
      channelLabel: "雑談",
      previousSummary: "前回までのあらすじ",
      messages: [{ speaker: "haru", text: "やあ" }],
    });
    expect(prompt).toContain("雑談");
    expect(prompt).toContain("前回までのあらすじ");
    expect(prompt).toContain("やあ");
  });

  it("既存あらすじが無くても生成できる", () => {
    const prompt = buildSummaryPrompt({
      channelLabel: "雑談",
      previousSummary: null,
      messages: [{ speaker: "haru", text: "やあ" }],
    });
    expect(prompt).toContain("やあ");
  });
});
