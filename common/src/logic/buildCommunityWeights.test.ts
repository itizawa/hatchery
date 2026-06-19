import { describe, expect, it } from "vitest";

import { buildCommunityWeights } from "./buildCommunityWeights.js";

describe("buildCommunityWeights", () => {
  it("net スコアのない community は cold start 床 +1 の重みを返す", () => {
    const communityIds = ["c1", "c2"];
    const netScores = new Map<string, number>();
    const weights = buildCommunityWeights({ communityIds, netScores });
    expect(weights).toEqual([
      { communityId: "c1", weight: 1 },
      { communityId: "c2", weight: 1 },
    ]);
  });

  it("正の net スコアは max(0, score) + 1 を重みにする", () => {
    const communityIds = ["c1"];
    const netScores = new Map([["c1", 5]]);
    const weights = buildCommunityWeights({ communityIds, netScores });
    expect(weights).toEqual([{ communityId: "c1", weight: 6 }]);
  });

  it("負の net スコアは 0 に丸めて床 +1 の重みにする", () => {
    const communityIds = ["c1"];
    const netScores = new Map([["c1", -10]]);
    const weights = buildCommunityWeights({ communityIds, netScores });
    expect(weights).toEqual([{ communityId: "c1", weight: 1 }]);
  });

  it("0 の net スコアは床 +1 の重みにする", () => {
    const communityIds = ["c1"];
    const netScores = new Map([["c1", 0]]);
    const weights = buildCommunityWeights({ communityIds, netScores });
    expect(weights).toEqual([{ communityId: "c1", weight: 1 }]);
  });

  it("複数コミュニティを正しく変換する", () => {
    const communityIds = ["c1", "c2", "c3"];
    const netScores = new Map([
      ["c1", 10],
      ["c2", -3],
      // c3 はスコアなし
    ]);
    const weights = buildCommunityWeights({ communityIds, netScores });
    expect(weights).toEqual([
      { communityId: "c1", weight: 11 },
      { communityId: "c2", weight: 1 },
      { communityId: "c3", weight: 1 },
    ]);
  });

  it("communityIds が空のときは空配列を返す", () => {
    const netScores = new Map<string, number>();
    const weights = buildCommunityWeights({ communityIds: [], netScores });
    expect(weights).toEqual([]);
  });

  it("入力配列を破壊しない", () => {
    const communityIds = ["c1", "c2"];
    const netScores = new Map([["c1", 3]]);
    const original = [...communityIds];
    buildCommunityWeights({ communityIds, netScores });
    expect(communityIds).toEqual(original);
  });
});
