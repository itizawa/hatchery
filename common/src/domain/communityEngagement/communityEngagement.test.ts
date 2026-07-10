import { describe, expect, it } from "vitest";
import {
  CommunityEngagementSchema,
  CommunityVoteEntrySchema,
  WorkerVoteEntrySchema,
} from "./communityEngagement.js";

describe("CommunityVoteEntrySchema", () => {
  const validEntry = {
    communityId: "community-1",
    count: 10,
    sharePercent: 42.5,
  };

  it("有効なデータをパースできる", () => {
    const result = CommunityVoteEntrySchema.parse(validEntry);
    expect(result.communityId).toBe("community-1");
    expect(result.count).toBe(10);
    expect(result.sharePercent).toBe(42.5);
  });

  it("count が負の場合はエラー", () => {
    expect(() => CommunityVoteEntrySchema.parse({ ...validEntry, count: -1 })).toThrow();
  });
});

describe("WorkerVoteEntrySchema", () => {
  const validEntry = {
    workerId: "worker-1",
    count: 5,
    sharePercent: 12.3,
  };

  it("有効なデータをパースできる", () => {
    const result = WorkerVoteEntrySchema.parse(validEntry);
    expect(result.workerId).toBe("worker-1");
    expect(result.count).toBe(5);
    expect(result.sharePercent).toBe(12.3);
  });

  it("count が負の場合はエラー", () => {
    expect(() => WorkerVoteEntrySchema.parse({ ...validEntry, count: -1 })).toThrow();
  });
});

describe("CommunityEngagementSchema", () => {
  const validEngagement = {
    windowDays: 7,
    communityVotes: [{ communityId: "community-1", count: 10, sharePercent: 100 }],
    workerVotes: [{ workerId: "worker-1", count: 10, sharePercent: 100 }],
    loyaltyScore: 0.5,
    subscriberCountByCommunity: { "community-1": 3 },
  };

  it("有効なデータをパースできる", () => {
    const result = CommunityEngagementSchema.parse(validEngagement);
    expect(result.windowDays).toBe(7);
    expect(result.communityVotes).toHaveLength(1);
    expect(result.workerVotes).toHaveLength(1);
    expect(result.loyaltyScore).toBe(0.5);
    expect(result.subscriberCountByCommunity).toEqual({ "community-1": 3 });
  });

  it("loyaltyScore が 0 の場合は OK", () => {
    const result = CommunityEngagementSchema.parse({ ...validEngagement, loyaltyScore: 0 });
    expect(result.loyaltyScore).toBe(0);
  });

  it("loyaltyScore が 1 の場合は OK", () => {
    const result = CommunityEngagementSchema.parse({ ...validEngagement, loyaltyScore: 1 });
    expect(result.loyaltyScore).toBe(1);
  });

  it("loyaltyScore が負の場合はエラー", () => {
    expect(() =>
      CommunityEngagementSchema.parse({ ...validEngagement, loyaltyScore: -0.1 })
    ).toThrow();
  });

  it("loyaltyScore が 1 を超える場合はエラー", () => {
    expect(() =>
      CommunityEngagementSchema.parse({ ...validEngagement, loyaltyScore: 1.1 })
    ).toThrow();
  });

  it("windowDays が 0 の場合はエラー", () => {
    expect(() => CommunityEngagementSchema.parse({ ...validEngagement, windowDays: 0 })).toThrow();
  });

  it("subscriberCountByCommunity の値が負の場合はエラー", () => {
    expect(() =>
      CommunityEngagementSchema.parse({
        ...validEngagement,
        subscriberCountByCommunity: { "community-1": -1 },
      })
    ).toThrow();
  });
});
