import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
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
  it("未認証でも全 community の投稿を新着順で取得できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "My Post", text: "Text" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0]).toMatchObject({ title: "My Post" });
  });

  it("認証済みユーザーでも購読に関係なく全 community の投稿を取得できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      makeCommunity({ id: "community-1", slug: "tech" }),
      makeCommunity({ id: "community-2", slug: "science" }),
    ]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Tech Post", text: "Tech" },
    ]);
    await postRepo.createMany("community-2", [
      { slotKey: "2026-06-10T10:00", seq: 0, author: "worker-2", title: "Science Post", text: "Sci" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app).get("/api/feed").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(2);
  });

  it("投稿が 0 件のときは posts が空配列・nextCursor が null", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [], nextCursor: null });
  });

  it("cursor なしで先頭ページを取得し nextCursor が非 null（次ページあり）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 25; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: `slot-${String(i).padStart(2, "0")}`, seq: 0, author: "worker-1", title: `Post ${i}`, text: "text" },
      ]);
    }

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(20);
    expect(res.body.nextCursor).not.toBeNull();
    expect(typeof res.body.nextCursor).toBe("string");
  });

  it("nextCursor を使って次ページを取得でき、境界で重複/欠落がない", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 25; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: `slot-${String(i).padStart(2, "0")}`, seq: 0, author: "worker-1", title: `Post ${i}`, text: "text" },
      ]);
    }

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const page1 = await request(app).get("/api/feed?limit=10");
    expect(page1.status).toBe(200);
    expect(page1.body.posts).toHaveLength(10);
    const cursor = page1.body.nextCursor as string;
    expect(cursor).not.toBeNull();

    const page2 = await request(app).get(`/api/feed?limit=10&cursor=${cursor}`);
    expect(page2.status).toBe(200);
    expect(page2.body.posts).toHaveLength(10);

    const page1Ids = page1.body.posts.map((p: { id: string }) => p.id) as string[];
    const page2Ids = page2.body.posts.map((p: { id: string }) => p.id) as string[];

    const allIds = [...page1Ids, ...page2Ids];
    expect(allIds.length).toBe(new Set(allIds).size);
  });

  it("最後のページで nextCursor が null", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 5; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: `slot-${i}`, seq: 0, author: "worker-1", title: `Post ${i}`, text: "text" },
      ]);
    }

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(5);
    expect(res.body.nextCursor).toBeNull();
  });

  it("limit=101 は 400 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed?limit=101");
    expect(res.status).toBe(400);
  });

  it("limit=0 は 400 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed?limit=0");
    expect(res.status).toBe(400);
  });

  it("不正な cursor（base64 デコードで JSON でない）は 400 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const invalidCursor = Buffer.from("not-valid-json").toString("base64");
    const res = await request(app).get(`/api/feed?cursor=${invalidCursor}`);
    expect(res.status).toBe(400);
  });

  it("limit=1 で 1 件ずつページングできる（重複なし・欠落なし）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 3; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: `slot-${i}`, seq: 0, author: "worker-1", title: `Post ${i}`, text: "text" },
      ]);
    }

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const p1 = await request(app).get("/api/feed?limit=1");
    expect(p1.body.posts).toHaveLength(1);
    const p2 = await request(app).get(`/api/feed?limit=1&cursor=${p1.body.nextCursor}`);
    expect(p2.body.posts).toHaveLength(1);
    const p3 = await request(app).get(`/api/feed?limit=1&cursor=${p2.body.nextCursor}`);
    expect(p3.body.posts).toHaveLength(1);
    expect(p3.body.nextCursor).toBeNull();

    const allIds = [p1, p2, p3].flatMap((r) => r.body.posts.map((p: { id: string }) => p.id)) as string[];
    expect(allIds.length).toBe(3);
    expect(new Set(allIds).size).toBe(3);
  });

  it("sort=popular で score 降順に取得できる", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const created = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "Low", text: "t" },
      { slotKey: "s", seq: 1, author: "w", title: "High", text: "t" },
      { slotKey: "s", seq: 2, author: "w", title: "Mid", text: "t" },
    ]);
    await postRepo.addScore(created[0].id, 1);
    await postRepo.addScore(created[1].id, 100);
    await postRepo.addScore(created[2].id, 10);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/feed?sort=popular");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual(["High", "Mid", "Low"]);
  });

  it("sort=latest（明示）は新着順で返す（後方互換）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "Old", text: "t" },
    ]);
    await new Promise((r) => setTimeout(r, 5));
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 1, author: "w", title: "New", text: "t" },
    ]);

    const deps = await createTestDeps({
      communityRepository: communityRepo,
      postRepository: postRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get("/api/feed?sort=latest");
    expect(res.status).toBe(200);
    expect(res.body.posts[0].title).toBe("New");
  });

  it("不正な sort 値は 400 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed?sort=hot");
    expect(res.status).toBe(400);
  });

  it("sort=popular でも不正な cursor は 400 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const invalidCursor = Buffer.from("not-valid-json").toString("base64");
    const res = await request(app).get(`/api/feed?sort=popular&cursor=${invalidCursor}`);
    expect(res.status).toBe(400);
  });
});
