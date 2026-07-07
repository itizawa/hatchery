import { describe, expect, it } from "vitest";

import {
  COMMUNITY_WORKERS_MAX,
  CommunityWorkerSummarySchema,
  CommunityWorkerAssignmentsSchema,
  SetCommunityWorkersSchema,
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
    // eslint-disable-next-line max-params
    const tooMany = Array.from({ length: WORKER_COMMUNITIES_MAX + 1 }, (_, i) => `c${i}`);
    expect(
      WorkerCommunityIdsSchema.safeParse({ communityIds: tooMany }).success,
    ).toBe(false);
  });

  it(`配列サイズが上限ちょうど（${WORKER_COMMUNITIES_MAX}）は受理する`, () => {
    // eslint-disable-next-line max-params
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

describe("SetCommunityWorkersSchema（#1079）", () => {
  it("workerId の配列を受理する", () => {
    const parsed = SetCommunityWorkersSchema.parse({ workerIds: ["w1", "w2"] });
    expect(parsed.workerIds).toEqual(["w1", "w2"]);
  });

  it("空配列を受理する（所属ワーカー無しを表す）", () => {
    expect(SetCommunityWorkersSchema.parse({ workerIds: [] }).workerIds).toEqual([]);
  });

  it("workerIds が無いと parse 失敗する", () => {
    expect(SetCommunityWorkersSchema.safeParse({}).success).toBe(false);
  });

  it("空文字の id を含むと parse 失敗する", () => {
    expect(
      SetCommunityWorkersSchema.safeParse({ workerIds: ["w1", ""] }).success,
    ).toBe(false);
  });

  it(`id が ${WORKER_COMMUNITY_ID_MAX_LENGTH} 文字を超えると parse 失敗する`, () => {
    const tooLong = "x".repeat(WORKER_COMMUNITY_ID_MAX_LENGTH + 1);
    expect(
      SetCommunityWorkersSchema.safeParse({ workerIds: [tooLong] }).success,
    ).toBe(false);
  });

  it(`配列サイズが ${COMMUNITY_WORKERS_MAX} を超えると parse 失敗する`, () => {
    // eslint-disable-next-line max-params
    const tooMany = Array.from({ length: COMMUNITY_WORKERS_MAX + 1 }, (_, i) => `w${i}`);
    expect(
      SetCommunityWorkersSchema.safeParse({ workerIds: tooMany }).success,
    ).toBe(false);
  });

  it(`配列サイズが上限ちょうど（${COMMUNITY_WORKERS_MAX}）は受理する`, () => {
    // eslint-disable-next-line max-params
    const max = Array.from({ length: COMMUNITY_WORKERS_MAX }, (_, i) => `w${i}`);
    expect(SetCommunityWorkersSchema.safeParse({ workerIds: max }).success).toBe(true);
  });
});

describe("CommunityWorkerSummarySchema / CommunityWorkerAssignmentsSchema（#1079）", () => {
  it("id と displayName を持つオブジェクトを受理する", () => {
    const parsed = CommunityWorkerSummarySchema.parse({ id: "w1", displayName: "haru" });
    expect(parsed).toEqual({ id: "w1", displayName: "haru" });
  });

  it("displayName が無いと parse 失敗する", () => {
    expect(CommunityWorkerSummarySchema.safeParse({ id: "w1" }).success).toBe(false);
  });

  it("CommunityWorkerAssignmentsSchema は workers 配列を受理する", () => {
    const parsed = CommunityWorkerAssignmentsSchema.parse({
      workers: [{ id: "w1", displayName: "haru" }],
    });
    expect(parsed.workers).toEqual([{ id: "w1", displayName: "haru" }]);
  });

  it("CommunityWorkerAssignmentsSchema は空配列を受理する", () => {
    expect(CommunityWorkerAssignmentsSchema.parse({ workers: [] }).workers).toEqual([]);
  });
});
