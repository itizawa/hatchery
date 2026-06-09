import { describe, expect, it } from "vitest";

import type { RecentEntry } from "./formatRecentLog.js";
import { formatRecentLog } from "./formatRecentLog.js";

/**
 * Issue #304 で Message → RecentEntry へ型を更新（ADR-0019 の Post/Comment モデル移行）。
 * 旧: Message { createdEmployeeId, channel, text }
 * 新: RecentEntry { community_id, author, text, title? }
 */
const entry = (author: string, community_id: string, text: string): RecentEntry => ({
  author,
  community_id,
  text,
});

const sample: RecentEntry[] = [
  entry("haru", "zatsudan", "1つめ"),
  entry("mei", "zatsudan", "2つめ"),
  entry("mei", "shigoto", "3つめ"),
  entry("haru", "shigoto", "4つめ"),
];

describe("formatRecentLog (B-1)", () => {
  it("n 件超のときは末尾 n 件のみを整形する", () => {
    expect(formatRecentLog(sample, 2)).toEqual(["[shigoto] mei: 3つめ", "[shigoto] haru: 4つめ"]);
  });

  it("各発言を [community_id] author: text 形式に整形する", () => {
    expect(formatRecentLog([entry("haru", "zatsudan", "やあ")], 5)).toEqual([
      "[zatsudan] haru: やあ",
    ]);
  });

  it("entries.length <= n のときは全件返す", () => {
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
