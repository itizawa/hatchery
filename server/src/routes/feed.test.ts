import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { InMemoryPostRepository } from "../persistence/postRepository.js";
import { InMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const makeCommunity = (overrides: Partial<CommunityRecord> = {}): CommunityRecord => ({
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "テクノロジーコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("GET /api/feed", () => {
  it("認証済みユーザーの購読 community の投稿フィードを取得できる", async () => {
    const communityRepo = new InMemoryCommunityRepository([makeCommunity()]);
    const postRepo = new InMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "My Post", text: "Text" },
    ]);
    const subscriptionRepo = new InMemorySubscriptionRepository();
    // testuser の id は "testuser"（InMemoryUserRepository.createWithTestUser より）
    await subscriptionRepo.add("testuser", "community-1");

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app).get("/api/feed").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "My Post" });
  });

  it("購読なしの場合は空配列を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app).get("/api/feed").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("未認証では 401 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(401);
  });
});
