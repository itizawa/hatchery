import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
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
  feedUrl: null,
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

  it("投稿が 0 件の community は post_count: 0 と last_post_at: null を返す（#527）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("post_count", 0);
    expect(res.body[0]).toHaveProperty("last_post_at", null);
  });

  it("投稿がある community は正しい post_count と last_post_at を返す（#527）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title1", text: "Text1" },
      { slotKey: "2026-06-10T12:00", seq: 0, author: "worker-1", title: "Title2", text: "Text2" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("post_count", 2);
    expect(res.body[0].last_post_at).not.toBeNull();
  });

  it("複数 community がある場合、それぞれ独立した post_count を返す（N+1 回避・#527）", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      makeCommunity({ id: "community-1", slug: "technology" }),
      makeCommunity({ id: "community-2", slug: "science", name: "Science" }),
    ]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "slot-1", seq: 0, author: "worker-1", title: "T1", text: "X" },
      { slotKey: "slot-1", seq: 1, author: "worker-1", title: "T2", text: "X" },
      { slotKey: "slot-1", seq: 2, author: "worker-1", title: "T3", text: "X" },
    ]);
    await postRepo.createMany("community-2", [
      { slotKey: "slot-1", seq: 0, author: "worker-1", title: "T4", text: "X" },
    ]);
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    const comm1 = (res.body as { id: string; post_count: number }[]).find((c) => c.id === "community-1");
    const comm2 = (res.body as { id: string; post_count: number }[]).find((c) => c.id === "community-2");
    expect(comm1).toHaveProperty("post_count", 3);
    expect(comm2).toHaveProperty("post_count", 1);
  });

  it("購読者が 0 件の community は subscriber_count: 0 を返す（#930）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("subscriber_count", 0);
  });

  it("購読者がいる community は正しい subscriber_count を返す（#930）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    await subscriptionRepo.add("user-1", "community-1");
    await subscriptionRepo.add("user-2", "community-1");
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("subscriber_count", 2);
  });

  it("複数 community がある場合それぞれ独立した subscriber_count を返す（N+1 回避・#930）", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      makeCommunity({ id: "community-1", slug: "technology" }),
      makeCommunity({ id: "community-2", slug: "science", name: "Science" }),
    ]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    await subscriptionRepo.add("user-1", "community-1");
    await subscriptionRepo.add("user-2", "community-1");
    await subscriptionRepo.add("user-1", "community-2");
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities");
    expect(res.status).toBe(200);
    const comm1 = (res.body as { id: string; subscriber_count: number }[]).find(
      (c) => c.id === "community-1",
    );
    const comm2 = (res.body as { id: string; subscriber_count: number }[]).find(
      (c) => c.id === "community-2",
    );
    expect(comm1).toHaveProperty("subscriber_count", 2);
    expect(comm2).toHaveProperty("subscriber_count", 1);
  });
});

describe("GET /api/communities/:slug/feed", () => {
  it("community の投稿フィードを取得できる（認証不要・ページネーション形式）", async () => {
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
    expect(res.body).toHaveProperty("posts");
    expect(res.body).toHaveProperty("nextCursor");
    expect(res.body.posts).toHaveLength(1);
    // OpenAPI スキーマ（PostSchema）は snake_case の community_id が正本（#499）
    expect(res.body.posts[0]).toMatchObject({ title: "Title", community_id: "community-1" });
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
    const post = res.body.posts[0];
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
    expect(res.body.posts[0].author_worker).toEqual({
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
    expect(res.body.posts[0].author_worker).toBeUndefined();
  });

  it("cursor と limit でページネーションできる（#881）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 5; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
      ]);
      await new Promise((r) => setTimeout(r, 2));
    }
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);
    const res1 = await request(app).get("/api/communities/technology/feed?limit=2");
    expect(res1.status).toBe(200);
    expect(res1.body.posts).toHaveLength(2);
    expect(res1.body.nextCursor).not.toBeNull();

    const res2 = await request(app).get(`/api/communities/technology/feed?limit=2&cursor=${res1.body.nextCursor}`);
    expect(res2.status).toBe(200);
    expect(res2.body.posts).toHaveLength(2);

    const res3 = await request(app).get(`/api/communities/technology/feed?limit=2&cursor=${res2.body.nextCursor}`);
    expect(res3.status).toBe(200);
    expect(res3.body.posts).toHaveLength(1);
    expect(res3.body.nextCursor).toBeNull();

    const allTitles = [
      ...res1.body.posts,
      ...res2.body.posts,
      ...res3.body.posts,
    ].map((p: { title: string }) => p.title);
    expect(allTitles).toEqual(["P4", "P3", "P2", "P1", "P0"]);
  });

  it("不正な cursor で 400 を返す（#881）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const invalid = Buffer.from("not-json").toString("base64");
    const res = await request(app).get(`/api/communities/technology/feed?cursor=${invalid}`);
    expect(res.status).toBe(400);
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
    // eslint-disable-next-line max-params
    const workers = Array.from({ length: 12 }, (_, i) => ({
      id: `worker-${i}`,
      displayName: `name-${i}`,
    }));
    const workerRepo = createInMemoryWorkerRepository(workers);
    await postRepo.createMany(
      "community-1",
      // eslint-disable-next-line max-params
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

describe("PATCH /api/communities/:slug/mark-viewed", () => {
  it("購読済みユーザーは 204 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({ communityRepository: communityRepo, subscriptionRepository: subscriptionRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];
    await request(app).post("/api/communities/technology/subscribe").set("Cookie", cookie);

    const res = await request(app)
      .patch("/api/communities/technology/mark-viewed")
      .set("Cookie", cookie);
    expect(res.status).toBe(204);
  });

  it("未購読ユーザーは 403 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .patch("/api/communities/technology/mark-viewed")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("存在しないコミュニティは 404 が返る", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .patch("/api/communities/not-exists/mark-viewed")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("未認証は 401 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const res = await request(app).patch("/api/communities/technology/mark-viewed");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/communities/:slug/feed my_vote 付与（#831）", () => {
  it("sessionId を付与すると投票済み post に my_vote が付く", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P", text: "t" },
    ]);
    const voteRepo = createInMemoryVoteRepository();
    await voteRepo.vote({ sessionId: "00000000-0000-0000-0000-000000000001", userId: null, targetType: "post", targetId: post.id, direction: "up" });

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
      voteRepository: voteRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed?sessionId=00000000-0000-0000-0000-000000000001");
    expect(res.status).toBe(200);
    expect(res.body.posts[0].my_vote).toBe("up");
  });

  it("sessionId を付与しても未投票 post には my_vote が付かない", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P", text: "t" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed?sessionId=00000000-0000-0000-0000-000000000002");
    expect(res.status).toBe(200);
    expect(res.body.posts[0]).not.toHaveProperty("my_vote");
  });

  it("sessionId 未指定のときは my_vote を含まない（後方互換）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P", text: "t" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts[0]).not.toHaveProperty("my_vote");
  });

  it("不正な sessionId（UUID でない値）のときは my_vote を含まない", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P", text: "t" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed?sessionId=not-a-uuid");
    expect(res.status).toBe(200);
    expect(res.body.posts[0]).not.toHaveProperty("my_vote");
  });
});
