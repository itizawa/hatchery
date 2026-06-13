import { describe, expect, it } from "vitest";

import { selectWeightedCommunity, type CommunityWeight } from "./selectWeightedCommunity.js";

/** 固定値を返す rng を作る（決定的テスト用）。 */
const fixedRng = (value: number): (() => number) => {
  return () => value;
};

describe("selectWeightedCommunity (#486)", () => {
  it("コミュニティ 0 件のときは null を返す", () => {
    expect(selectWeightedCommunity([], fixedRng(0.5))).toBeNull();
  });

  it("コミュニティ 1 件のみのときは rng に関わらずそれを返す", () => {
    const one: CommunityWeight[] = [{ communityId: "a", weight: 1 }];
    expect(selectWeightedCommunity(one, fixedRng(0))).toBe("a");
    expect(selectWeightedCommunity(one, fixedRng(0.999999))).toBe("a");
  });

  it("rng を固定すると決定的に特定コミュニティが選ばれる（累積重み法）", () => {
    // weight: a=1, b=2, c=3, total=6。累積境界: a=[0,1), b=[1,3), c=[3,6)
    const communities: CommunityWeight[] = [
      { communityId: "a", weight: 1 },
      { communityId: "b", weight: 2 },
      { communityId: "c", weight: 3 },
    ];
    // r = rng*total
    expect(selectWeightedCommunity(communities, fixedRng(0))).toBe("a"); // r=0 → a
    expect(selectWeightedCommunity(communities, fixedRng(0.1))).toBe("a"); // r=0.6 → a
    expect(selectWeightedCommunity(communities, fixedRng(0.25))).toBe("b"); // r=1.5 → b
    expect(selectWeightedCommunity(communities, fixedRng(0.5))).toBe("c"); // r=3.0 → c (境界値)
    expect(selectWeightedCommunity(communities, fixedRng(0.99))).toBe("c"); // r=5.94 → c
  });

  it("累積重みのちょうど境界値（r が累積和に一致）は次のコミュニティに割り当てる", () => {
    // weight: a=1, b=1, total=2。累積: a=[0,1), b=[1,2)
    const communities: CommunityWeight[] = [
      { communityId: "a", weight: 1 },
      { communityId: "b", weight: 1 },
    ];
    // r = 0.5*2 = 1.0 → 累積和 a=1 とちょうど一致 → b（[1,2) 区間）
    expect(selectWeightedCommunity(communities, fixedRng(0.5))).toBe("b");
  });

  it("weight 0 のコミュニティは他に正の重みがある限り選ばれない", () => {
    const communities: CommunityWeight[] = [
      { communityId: "zero", weight: 0 },
      { communityId: "pos", weight: 5 },
    ];
    // どの rng でも zero は選ばれない（区間幅 0）
    expect(selectWeightedCommunity(communities, fixedRng(0))).toBe("pos");
    expect(selectWeightedCommunity(communities, fixedRng(0.5))).toBe("pos");
    expect(selectWeightedCommunity(communities, fixedRng(0.999))).toBe("pos");
  });

  it("床 +1 を適用した重みでは vote 0 の新規コミュニティも稀に選ばれる", () => {
    // 床込みの重み: hot=11（純vote 10 + 1）, new=1（純vote 0 + 1）。total=12
    // new の区間は [11, 12)。rng がこの帯に入ると new が選ばれる。
    const communities: CommunityWeight[] = [
      { communityId: "hot", weight: 11 },
      { communityId: "new", weight: 1 },
    ];
    // r = 11.5（rng = 11.5/12 ≒ 0.9583）→ new
    expect(selectWeightedCommunity(communities, fixedRng(11.5 / 12))).toBe("new");
    // r = 5（rng = 5/12 ≒ 0.4167）→ hot
    expect(selectWeightedCommunity(communities, fixedRng(5 / 12))).toBe("hot");
  });

  it("全 weight が 0 のときは先頭コミュニティを決定的に返す（フォールバック）", () => {
    const communities: CommunityWeight[] = [
      { communityId: "x", weight: 0 },
      { communityId: "y", weight: 0 },
    ];
    expect(selectWeightedCommunity(communities, fixedRng(0))).toBe("x");
    expect(selectWeightedCommunity(communities, fixedRng(0.99))).toBe("x");
  });

  it("入力配列を破壊しない", () => {
    const communities: CommunityWeight[] = [
      { communityId: "a", weight: 1 },
      { communityId: "b", weight: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(communities));
    selectWeightedCommunity(communities, fixedRng(0.5));
    expect(communities).toEqual(snapshot);
  });

  it("既定の rng（Math.random）でも常にいずれかのコミュニティを返す", () => {
    const communities: CommunityWeight[] = [
      { communityId: "a", weight: 1 },
      { communityId: "b", weight: 1 },
      { communityId: "c", weight: 1 },
    ];
    for (let i = 0; i < 50; i++) {
      const selected = selectWeightedCommunity(communities);
      expect(["a", "b", "c"]).toContain(selected);
    }
  });
});
