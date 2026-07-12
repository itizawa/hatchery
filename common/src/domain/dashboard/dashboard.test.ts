import { describe, expect, it } from "vitest";

import { DashboardCommunityBreakdownSchema, DashboardSummarySchema } from "./dashboard.js";

describe("DashboardCommunityBreakdownSchema", () => {
  const validBreakdown = {
    community_id: "community-1",
    slug: "tech",
    name: "Technology",
    post_count: 10,
    subscriber_count: 5,
    view_count: 120,
  };

  it("有効なデータをパースできる", () => {
    const result = DashboardCommunityBreakdownSchema.parse(validBreakdown);
    expect(result).toEqual(validBreakdown);
  });

  it("post_count が負の場合はエラー", () => {
    expect(() =>
      DashboardCommunityBreakdownSchema.parse({ ...validBreakdown, post_count: -1 }),
    ).toThrow();
  });

  it("subscriber_count が負の場合はエラー", () => {
    expect(() =>
      DashboardCommunityBreakdownSchema.parse({ ...validBreakdown, subscriber_count: -1 }),
    ).toThrow();
  });

  it("view_count が負の場合はエラー", () => {
    expect(() =>
      DashboardCommunityBreakdownSchema.parse({ ...validBreakdown, view_count: -1 }),
    ).toThrow();
  });

  it("view_count が小数の場合はエラー", () => {
    expect(() =>
      DashboardCommunityBreakdownSchema.parse({ ...validBreakdown, view_count: 1.5 }),
    ).toThrow();
  });
});

describe("DashboardSummarySchema", () => {
  const validSummary = {
    community_count: 2,
    worker_count: 3,
    post_count: 10,
    comment_count: 20,
    total_view_count: 300,
    total_vote_count: 40,
    total_subscription_count: 5,
    communities: [
      {
        community_id: "community-1",
        slug: "tech",
        name: "Technology",
        post_count: 10,
        subscriber_count: 5,
        view_count: 300,
      },
    ],
  };

  it("有効なデータをパースできる", () => {
    const result = DashboardSummarySchema.parse(validSummary);
    expect(result).toEqual(validSummary);
  });

  it("communities が空配列でも OK", () => {
    const result = DashboardSummarySchema.parse({ ...validSummary, communities: [] });
    expect(result.communities).toEqual([]);
  });

  it("community_count が負の場合はエラー", () => {
    expect(() => DashboardSummarySchema.parse({ ...validSummary, community_count: -1 })).toThrow();
  });

  it("worker_count が負の場合はエラー", () => {
    expect(() => DashboardSummarySchema.parse({ ...validSummary, worker_count: -1 })).toThrow();
  });

  it("post_count が負の場合はエラー", () => {
    expect(() => DashboardSummarySchema.parse({ ...validSummary, post_count: -1 })).toThrow();
  });

  it("comment_count が負の場合はエラー", () => {
    expect(() => DashboardSummarySchema.parse({ ...validSummary, comment_count: -1 })).toThrow();
  });

  it("total_view_count が負の場合はエラー", () => {
    expect(() =>
      DashboardSummarySchema.parse({ ...validSummary, total_view_count: -1 }),
    ).toThrow();
  });

  it("total_vote_count が負の場合はエラー", () => {
    expect(() =>
      DashboardSummarySchema.parse({ ...validSummary, total_vote_count: -1 }),
    ).toThrow();
  });

  it("total_subscription_count が負の場合はエラー", () => {
    expect(() =>
      DashboardSummarySchema.parse({ ...validSummary, total_subscription_count: -1 }),
    ).toThrow();
  });

  it("communities 配下の要素も検証される（post_count 負でエラー）", () => {
    expect(() =>
      DashboardSummarySchema.parse({
        ...validSummary,
        communities: [{ ...validSummary.communities[0], post_count: -1 }],
      }),
    ).toThrow();
  });
});
