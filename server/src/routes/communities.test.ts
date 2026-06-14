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
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
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

  it("OpenAPI 契約どおり created_at（snake_case）を返し camelCase の createdAt は含めない（#477）", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      makeCommunity({ createdAt: new Date("2026-06-09T23:08:20.519Z") }),
    ]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("created_at");
    expect(res.body[0]).not.toHaveProperty("createdAt");
    expect(new Date(res.body[0].created_at as string).toISOString()).toBe(
      "2026-06-09T23:08:20.519Z",
    );
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
    // OpenAPI スキーマ（PostSchema）は snake_case の community_id が正本（#499）
    expect(res.body[0]).toMatchObject({ title: "Title", community_id: "community-1" });
  });

  it("各 post のフィールド名が OpenAPI スキーマ（snake_case）と一致し camelCase を含まない（#499）", async () => {
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
    const post = res.body[0];
    expect(post).toHaveProperty("community_id", "community-1");
    expect(post).toHaveProperty("slot_key");
    expect(post).toHaveProperty("created_at");
    expect(post).not.toHaveProperty("communityId");
    expect(post).not.toHaveProperty("slotKey");
    expect(post).not.toHaveProperty("createdAt");
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

    await request(app)
      .post("/api/communities/technology/subscribe")
      .set("Cookie", cookie);

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

  it("post.author が displayName 文字列でも DB ワーカー（UUID id）を解決して返す（#478）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const workerRepo = createInMemoryWorkerRepository([
      { id: "c9226003-uuid", displayName: "haru", role: "ムードメーカー" },
      { id: "d89954ec-uuid", displayName: "ken", role: "ベテラン" },
      { id: "e0000000-uuid", displayName: "mei", role: "新人" },
    ]);
    await postRepo.createMany("community-1", [
      { slotKey: "slot-1", seq: 1, author: "haru", title: "T1", text: "X" },
      { slotKey: "slot-1", seq: 2, author: "ken", title: "T2", text: "X" },
      { slotKey: "slot-1", seq: 3, author: "mei", title: "T3", text: "X" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
    expect(res.status).toBe(200);
    const displayNames = (res.body as { displayName: string }[]).map((w) => w.displayName);
    expect(displayNames).toHaveLength(3);
    expect([...displayNames].sort()).toEqual(["haru", "ken", "mei"]);
  });

  it("RECENT_WORKERS_LIMIT を超える distinct author は先頭 10 件までに制限する（#478）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const workers = Array.from({ length: 12 }, (_, i) => ({
      id: `worker-${i}`,
      displayName: `name-${i}`,
    }));
    const workerRepo = createInMemoryWorkerRepository(workers);
    await postRepo.createMany(
      "community-1",
      workers.map((w, i) => ({
        slotKey: "slot-1",
        seq: i,
        author: w.displayName,
        title: `T${i}`,
        text: "X",
      })),
    );
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
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

describe("公開 API に generationInstruction が露出しない（#488）", () => {
  const communityWithInstruction = (): CommunityRecord => ({
    ...makeCommunity(),
    generationInstruction: "脱さん付け・率直に。絶対に公開しない指示。",
  });

  it("GET /api/communities のレスポンスに generationInstruction が含まれない", async () => {
    const communityRepo = createInMemoryCommunityRepository([communityWithInstruction()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty("generationInstruction");
  });

  it("GET /api/communities/:slug/feed のレスポンスに generationInstruction が含まれない", async () => {
    const communityRepo = createInMemoryCommunityRepository([communityWithInstruction()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("generationInstruction");
  });
});
