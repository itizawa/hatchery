import { describe, expect, it } from "vitest";

import {
  SetWorkerCommunitiesSchema,
  WORKER_COMMUNITIES_MAX,
  WORKER_COMMUNITY_ID_MAX_LENGTH,
  WorkerCommunityIdsSchema,
} from "./workerCommunity.js";

describe("WorkerCommunityIdsSchema（#490）", () => {
  it("communityId の配列を受理する", () => {
    const parsed = WorkerCommunityIdsSchema.parse({ communityIds: ["c1", "c2"] });
    expect(parsed.communityIds).toEqual(["c1", "c2"]);
  });

  it("空配列を受理する（参加コミュニティ無しを表す）", () => {
    expect(WorkerCommunityIdsSchema.parse({ communityIds: [] }).communityIds).toEqual([]);
  });

  it("communityIds が無いと parse 失敗する", () => {
    expect(WorkerCommunityIdsSchema.safeParse({}).success).toBe(false);
  });

  it("空文字の id を含むと parse 失敗する", () => {
    expect(
      WorkerCommunityIdsSchema.safeParse({ communityIds: ["c1", ""] }).success,
    ).toBe(false);
  });

  it(`id が ${WORKER_COMMUNITY_ID_MAX_LENGTH} 文字を超えると parse 失敗する`, () => {
    const tooLong = "x".repeat(WORKER_COMMUNITY_ID_MAX_LENGTH + 1);
    expect(
      WorkerCommunityIdsSchema.safeParse({ communityIds: [tooLong] }).success,
    ).toBe(false);
  });

  it(`配列サイズが ${WORKER_COMMUNITIES_MAX} を超えると parse 失敗する`, () => {
    const tooMany = Array.from({ length: WORKER_COMMUNITIES_MAX + 1 }, (_, i) => `c${i}`);
    expect(
      WorkerCommunityIdsSchema.safeParse({ communityIds: tooMany }).success,
    ).toBe(false);
  });

  it(`配列サイズが上限ちょうど（${WORKER_COMMUNITIES_MAX}）は受理する`, () => {
    const max = Array.from({ length: WORKER_COMMUNITIES_MAX }, (_, i) => `c${i}`);
    expect(WorkerCommunityIdsSchema.safeParse({ communityIds: max }).success).toBe(true);
  });
});

describe("SetWorkerCommunitiesSchema（#490）", () => {
  it("WorkerCommunityIdsSchema と同じ形を受理する", () => {
    const parsed = SetWorkerCommunitiesSchema.parse({ communityIds: ["a"] });
    expect(parsed.communityIds).toEqual(["a"]);
  });
});
