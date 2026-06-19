import { describe, expect, it } from "vitest";

import type { RecentEntry } from "./formatRecentLog.js";
import { formatRecentLog } from "./formatRecentLog.js";

/**
 * Post/Comment を入力とする formatRecentLog のテスト（Issue #304）。
 * 旧 Message 型との後方互換テストは formatRecentLog.test.ts を参照。
 */

// eslint-disable-next-line max-params
const entry = (community_id: string, author: string, text: string, title?: string): RecentEntry => ({
  community_id,
  author,
  text,
  title,
});

const sample: RecentEntry[] = [
  entry("comm-1", "worker-haru", "今日はバグと戦ってたよ", "今日の仕事"),
  entry("comm-1", "worker-ken", "それは大変だったね", undefined),
  entry("comm-2", "worker-mei", "他のコミュニティでも頑張ってます"),
  entry("comm-1", "worker-haru", "なんとか解決できた！"),
];

describe("formatRecentLog with RecentEntry (Community/Post/Comment モデル)", () => {
  it("n 件超のときは末尾 n 件のみを整形する", () => {
    const result = formatRecentLog({ entries: sample, n: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("worker-mei");
    expect(result[1]).toContain("worker-haru");
  });

  it("各エントリを [community_id] author: text 形式に整形する（title なし）", () => {
    const input = [entry("comm-1", "worker-ken", "お疲れ様")];
    const result = formatRecentLog({ entries: input, n: 5 });
    expect(result).toEqual(["[comm-1] worker-ken: お疲れ様"]);
  });

  it("title があれば [community_id] author: title / text 形式に整形する", () => {
    const input = [entry("comm-1", "worker-haru", "内容テキスト", "タイトル")];
    const result = formatRecentLog({ entries: input, n: 5 });
    expect(result).toEqual(["[comm-1] worker-haru: タイトル / 内容テキスト"]);
  });

  it("entries.length <= n のときは全件返す", () => {
    expect(formatRecentLog({ entries: sample, n: 10 })).toHaveLength(4);
    expect(formatRecentLog({ entries: sample, n: 4 })).toHaveLength(4);
  });

  it("n = 0 のときは空配列を返す", () => {
    expect(formatRecentLog({ entries: sample, n: 0 })).toEqual([]);
  });

  it("元配列を破壊しない", () => {
    const input = [...sample];
    formatRecentLog({ entries: input, n: 2 });
    expect(input).toHaveLength(4);
    expect(input).toEqual(sample);
  });
});
