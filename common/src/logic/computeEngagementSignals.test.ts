import { describe, expect, it } from "vitest";
import { computeLoyaltyScore, computeVoteShares } from "./computeEngagementSignals.js";

describe("computeVoteShares", () => {
  it("空の counts から空配列を返す", () => {
    const result = computeVoteShares({ counts: new Map() });
    expect(result).toEqual([]);
  });

  it("1 件の counts から sharePercent=100 のエントリを返す", () => {
    const counts = new Map([["community-a", 10]]);
    const result = computeVoteShares({ counts });
    expect(result).toEqual([{ id: "community-a", count: 10, sharePercent: 100 }]);
  });

  it("複数件の counts から sharePercent を正しく計算し count 降順で返す", () => {
    const counts = new Map([
      ["c1", 30],
      ["c2", 10],
      ["c3", 60],
    ]);
    const result = computeVoteShares({ counts });
    expect(result).toEqual([
      { id: "c3", count: 60, sharePercent: 60 },
      { id: "c1", count: 30, sharePercent: 30 },
      { id: "c2", count: 10, sharePercent: 10 },
    ]);
  });

  it("負の count は 0 として扱い全体合計が 0 のとき sharePercent=0 を返す", () => {
    const counts = new Map([["c1", -5]]);
    const result = computeVoteShares({ counts });
    expect(result).toHaveLength(1);
    expect(result[0].sharePercent).toBe(0);
  });
});

describe("computeLoyaltyScore", () => {
  it("ユーザーが 0 人のとき 0 を返す", () => {
    const score = computeLoyaltyScore({ userVotesByCommunity: new Map() });
    expect(score).toBe(0);
  });

  it("1 ユーザーが 1 コミュニティだけに投票 → 1.0", () => {
    const userMap: Map<string, Map<string, number>> = new Map([
      ["user-1", new Map([["community-a", 10]])],
    ]);
    const score = computeLoyaltyScore({ userVotesByCommunity: userMap });
    expect(score).toBe(1);
  });

  it("1 ユーザーが 2 コミュニティに均等投票 → 0.5", () => {
    const userMap: Map<string, Map<string, number>> = new Map([
      ["user-1", new Map([["c1", 5], ["c2", 5]])],
    ]);
    const score = computeLoyaltyScore({ userVotesByCommunity: userMap });
    expect(score).toBe(0.5);
  });

  it("複数ユーザーの平均を返す", () => {
    const userMap: Map<string, Map<string, number>> = new Map([
      ["user-1", new Map([["c1", 10]])],
      ["user-2", new Map([["c1", 5], ["c2", 5]])],
    ]);
    const score = computeLoyaltyScore({ userVotesByCommunity: userMap });
    expect(score).toBeCloseTo(0.75, 5);
  });

  it("ユーザーに votes がない（空 Map）→ スキップして平均に含めない", () => {
    const userMap: Map<string, Map<string, number>> = new Map([
      ["user-1", new Map()],
      ["user-2", new Map([["c1", 10]])],
    ]);
    const score = computeLoyaltyScore({ userVotesByCommunity: userMap });
    expect(score).toBe(1);
  });
});
