import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

describe("GET /api/subscriptions/unread-counts", () => {
  it("認証済みで購読なし → 空配列を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .get("/api/subscriptions/unread-counts")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unread_counts: [] });
  });

  it("認証済みで購読あり → unread_counts 配列を返す（community_id, community_slug, unread_count を含む）", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      {
        id: "community-1",
        slug: "technology",
        name: "Technology",
        description: "テクノロジー",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        feedUrl: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({ communityRepository: communityRepo, subscriptionRepository: subscriptionRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];
    await request(app).post("/api/communities/technology/subscribe").set("Cookie", cookie);

    const res = await request(app)
      .get("/api/subscriptions/unread-counts")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("unread_counts");
    expect(Array.isArray(res.body.unread_counts)).toBe(true);
    expect(res.body.unread_counts).toHaveLength(1);
    expect(res.body.unread_counts[0]).toMatchObject({
      community_id: "community-1",
      community_slug: expect.any(String),
      unread_count: expect.any(Number),
    });
  });

  it("未認証は 401 が返る", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/subscriptions/unread-counts");
    expect(res.status).toBe(401);
  });
});
