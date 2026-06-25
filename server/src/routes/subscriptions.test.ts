import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const makeCommunity = (overrides: Partial<CommunityRecord> = {}): CommunityRecord => ({
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
  feedUrl: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("GET /api/subscriptions/unread-counts", () => {
  it("未認証では 401 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/subscriptions/unread-counts");
    expect(res.status).toBe(401);
  });

  it("購読がない場合は空配列を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .get("/api/subscriptions/unread-counts")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("unread_counts");
    expect(res.body.unread_counts).toEqual([]);
  });

  it("購読しているコミュニティの unread_counts を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    // 購読を追加
    await request(app)
      .post("/api/communities/technology/subscribe")
      .set("Cookie", cookie);

    const res = await request(app)
      .get("/api/subscriptions/unread-counts")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("unread_counts");
    expect(Array.isArray(res.body.unread_counts)).toBe(true);
    expect(res.body.unread_counts.length).toBeGreaterThan(0);
    const entry = res.body.unread_counts[0];
    expect(entry).toHaveProperty("community_id");
    expect(entry).toHaveProperty("community_slug");
    expect(entry).toHaveProperty("unread_count");
    expect(typeof entry.unread_count).toBe("number");
  });
});
