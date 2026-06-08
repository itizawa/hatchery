import { describe, expect, it } from "vitest";

import type { Message } from "../domain/message/index.js";
import { formatRecentLog } from "./formatRecentLog.js";

const msg = (createdEmployeeId: string, channel: string, text: string): Message => ({
  createdEmployeeId,
  channel,
  text,
});

const sample: Message[] = [
  msg("haru", "zatsudan", "1つめ"),
  msg("mei", "zatsudan", "2つめ"),
  msg("mei", "shigoto", "3つめ"),
  msg("haru", "shigoto", "4つめ"),
];

describe("formatRecentLog (B-1)", () => {
  it("n 件超のときは末尾 n 件のみを整形する", () => {
    expect(formatRecentLog(sample, 2)).toEqual(["[shigoto] mei: 3つめ", "[shigoto] haru: 4つめ"]);
  });

  it("各発言を [channel] speaker: text 形式に整形する", () => {
    expect(formatRecentLog([msg("haru", "zatsudan", "やあ")], 5)).toEqual(["[zatsudan] haru: やあ"]);
  });

  it("messages.length <= n のときは全件返す", () => {
    expect(formatRecentLog(sample, 10)).toHaveLength(4);
    expect(formatRecentLog(sample, 4)).toHaveLength(4);
  });

  it("n = 0 のときは空配列を返す", () => {
    expect(formatRecentLog(sample, 0)).toEqual([]);
  });

  it("元配列を破壊しない", () => {
    const input = [...sample];
    formatRecentLog(input, 2);
    expect(input).toHaveLength(4);
    expect(input).toEqual(sample);
  });
});
