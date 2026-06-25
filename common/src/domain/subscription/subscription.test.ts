import { describe, expect, it } from "vitest";

import { SubscriptionSchema, UnreadCountSchema, UnreadCountsResponseSchema } from "./subscription.js";

describe("SubscriptionSchema", () => {
  const validSubscription = {
    user_id: "user-1",
    community_id: "comm-1",
    created_at: new Date("2026-06-10T09:00:00.000Z"),
  };

  it("有効なサブスクリプションをパースできる", () => {
    const result = SubscriptionSchema.safeParse(validSubscription);
    expect(result.success).toBe(true);
  });

  it("user_id を持つ", () => {
    const result = SubscriptionSchema.parse(validSubscription);
    expect(result.user_id).toBe("user-1");
  });

  it("community_id を持つ", () => {
    const result = SubscriptionSchema.parse(validSubscription);
    expect(result.community_id).toBe("comm-1");
  });

  it("created_at を持つ", () => {
    const result = SubscriptionSchema.parse(validSubscription);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("user_id が空文字を reject する", () => {
    const data = { ...validSubscription, user_id: "" };
    expect(SubscriptionSchema.safeParse(data).success).toBe(false);
  });

  it("community_id が空文字を reject する", () => {
    const data = { ...validSubscription, community_id: "" };
    expect(SubscriptionSchema.safeParse(data).success).toBe(false);
  });
});

describe("UnreadCountSchema", () => {
  const valid = { community_id: "c-1", community_slug: "tech", unread_count: 3 };

  it("有効なデータをパースできる", () => {
    expect(UnreadCountSchema.safeParse(valid).success).toBe(true);
  });

  it("unread_count が 0 でもパースできる", () => {
    expect(UnreadCountSchema.safeParse({ ...valid, unread_count: 0 }).success).toBe(true);
  });

  it("community_id が空文字を reject する", () => {
    expect(UnreadCountSchema.safeParse({ ...valid, community_id: "" }).success).toBe(false);
  });

  it("community_slug が空文字を reject する", () => {
    expect(UnreadCountSchema.safeParse({ ...valid, community_slug: "" }).success).toBe(false);
  });

  it("unread_count が負数を reject する", () => {
    expect(UnreadCountSchema.safeParse({ ...valid, unread_count: -1 }).success).toBe(false);
  });
});

describe("UnreadCountsResponseSchema", () => {
  it("空配列をパースできる", () => {
    expect(UnreadCountsResponseSchema.safeParse({ unread_counts: [] }).success).toBe(true);
  });

  it("複数の unread_counts をパースできる", () => {
    const result = UnreadCountsResponseSchema.safeParse({
      unread_counts: [
        { community_id: "c-1", community_slug: "tech", unread_count: 5 },
        { community_id: "c-2", community_slug: "daily", unread_count: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });
});
