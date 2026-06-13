import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
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

describe("GET /api/communities", () => {
  it("認証なしで community 一覧を取得できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: "community-1", slug: "technology" });
  });

  it("community が無い場合は空配列を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/communities/:slug/feed", () => {
  it("community の投稿フィードを取得できる（認証不要）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "Title", communityId: "community-1" });
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/not-exists/feed");
    expect(res.status).toBe(404);
  });

  it("各 post に author_worker（display_name + image_url）を付与する（#479）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "haru", title: "Title", text: "Text" },
    ]);
    const workerRepo = createInMemoryWorkerRepository([
      { id: "uuid-haru", displayName: "haru", role: null, personality: null, imageUrl: "https://example.com/haru.png" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body[0].author_worker).toEqual({
      id: "uuid-haru",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("解決できない author の post には author_worker を付与しない（#479）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "unknown", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.body[0].author_worker).toBeUndefined();
  });
});

describe("POST /api/communities/:slug/subscribe", () => {
  it("認証済みユーザーが community を購読できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    // ログイン
    const loginRes = await request(app).post("/api/auth/dev-login");
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post("/api/communities/technology/subscribe")
      .set("Cookie", cookie);
    expect(res.status).toBe(201);
  });

  it("未認証では 401 を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).post("/api/communities/technology/subscribe");
    expect(res.status).toBe(401);
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post("/api/communities/not-exists/subscribe")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/communities/:slug/subscribe", () => {
  it("認証済みユーザーが購読を解除できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    // まず購読
    await request(app)
      .post("/api/communities/technology/subscribe")
      .set("Cookie", cookie);

    // 購読解除
    const res = await request(app)
      .delete("/api/communities/technology/subscribe")
      .set("Cookie", cookie);
    expect(res.status).toBe(204);
  });

  it("未認証では 401 を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).delete("/api/communities/technology/subscribe");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/communities/:slug/subscription", () => {
  it("未認証ユーザーは subscribed: false が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/subscription");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false });
  });

  it("認証済みで未購読の場合は subscribed: false が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .get("/api/communities/technology/subscription")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false });
  });

  it("購読後は subscribed: true が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    // 購読する
    await request(app)
      .post("/api/communities/technology/subscribe")
      .set("Cookie", cookie);

    const res = await request(app)
      .get("/api/communities/technology/subscription")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: true });
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/not-exists/subscription");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/communities/:slug/recent-workers", () => {
  it("投稿があるとき distinct ワーカーを返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "Haru", role: "ムードメーカー" },
      { id: "worker-2", displayName: "Ken", role: "ベテラン" },
    ]);
    await postRepo.createMany("community-1", [
      { slotKey: "slot-1", seq: 1, author: "worker-1", title: "T1", text: "X" },
      { slotKey: "slot-1", seq: 2, author: "worker-2", title: "T2", text: "X" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((w) => w.id);
    expect(ids).toContain("worker-1");
    expect(ids).toContain("worker-2");
  });

  it("同じワーカーが複数投稿しても 1 件だけ返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "Haru", role: "ムードメーカー" },
    ]);
    await postRepo.createMany("community-1", [
      { slotKey: "slot-1", seq: 1, author: "worker-1", title: "T1", text: "X" },
      { slotKey: "slot-1", seq: 2, author: "worker-1", title: "T2", text: "X" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("投稿がない community は空配列を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/not-exists/recent-workers");
    expect(res.status).toBe(404);
  });
});
