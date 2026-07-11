import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
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

  it("sort=popular で score 降順の投稿が返る（#886）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const [p1, p2, p3] = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "Low Score", text: "t" },
      { slotKey: "s", seq: 1, author: "w", title: "High Score", text: "t" },
      { slotKey: "s", seq: 2, author: "w", title: "Mid Score", text: "t" },
    ]);
    await postRepo.addScore(p1!.id, 1);
    await postRepo.addScore(p2!.id, 10);
    await postRepo.addScore(p3!.id, 5);
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed?sort=popular");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual([
      "High Score",
      "Mid Score",
      "Low Score",
    ]);
  });

  it("sort=latest（明示）と sort 省略は同じ新着順で返る（#886）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    for (let i = 0; i < 3; i++) {
      await postRepo.createMany("community-1", [
        { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
      ]);
      await new Promise((r) => setTimeout(r, 2));
    }
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const resLatest = await request(app).get("/api/communities/technology/feed?sort=latest");
    const resDefault = await request(app).get("/api/communities/technology/feed");
    expect(resLatest.status).toBe(200);
    expect(resDefault.status).toBe(200);
    const titles = resLatest.body.posts.map((p: { title: string }) => p.title);
    expect(titles).toEqual(["P2", "P1", "P0"]);
    expect(resDefault.body.posts.map((p: { title: string }) => p.title)).toEqual(titles);
  });

  it("sort=popular でページネーションできる（#886）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const posts = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P0", text: "t" },
      { slotKey: "s", seq: 1, author: "w", title: "P1", text: "t" },
      { slotKey: "s", seq: 2, author: "w", title: "P2", text: "t" },
    ]);
    for (let i = 0; i < posts.length; i++) {
      await postRepo.addScore(posts[i]!.id, (i + 1) * 10);
    }
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res1 = await request(app).get("/api/communities/technology/feed?sort=popular&limit=2");
    expect(res1.status).toBe(200);
    expect(res1.body.posts).toHaveLength(2);
    expect(res1.body.nextCursor).not.toBeNull();

    const res2 = await request(app).get(
      `/api/communities/technology/feed?sort=popular&limit=2&cursor=${res1.body.nextCursor}`,
    );
    expect(res2.status).toBe(200);
    expect(res2.body.posts).toHaveLength(1);
    expect(res2.body.nextCursor).toBeNull();

    const allTitles = [...res1.body.posts, ...res2.body.posts].map((p: { title: string }) => p.title);
    expect(allTitles).toEqual(["P2", "P1", "P0"]);
  });

  it("pin された post は新着順に関わらず先頭に表示される（#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const titles = ["P0-oldest", "P1", "P2-newest"];
    const posts = [];
    for (const title of titles) {
      const [created] = await postRepo.createMany("community-1", [
        { slotKey: "s", seq: posts.length, author: "w", title, text: "t" },
      ]);
      posts.push(created!);
      await new Promise((r) => setTimeout(r, 2));
    }
    // 最も古い post を pin する。新着順なら本来末尾のはずが先頭に出ること。
    await postRepo.pinPost({ id: posts[0]!.id, pinnedAt: new Date() });
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual([
      "P0-oldest",
      "P2-newest",
      "P1",
    ]);
    expect(res.body.posts[0]).toMatchObject({ is_pinned: true });
  });

  it("pin された post は sort=popular でも先頭に表示される（#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const posts = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "Low Score", text: "t" },
      { slotKey: "s", seq: 1, author: "w", title: "High Score", text: "t" },
    ]);
    await postRepo.addScore(posts[0]!.id, 1);
    await postRepo.addScore(posts[1]!.id, 100);
    // score が最も低い post を pin する。人気順なら本来末尾のはずが先頭に出ること。
    await postRepo.pinPost({ id: posts[0]!.id, pinnedAt: new Date() });
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed?sort=popular");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual([
      "Low Score",
      "High Score",
    ]);
  });

  it("複数 pin は pinned_at 降順で表示される（#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const posts = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "older-pin", text: "t" },
      { slotKey: "s", seq: 1, author: "w", title: "newer-pin", text: "t" },
      { slotKey: "s", seq: 2, author: "w", title: "normal", text: "t" },
    ]);
    await postRepo.pinPost({ id: posts[0]!.id, pinnedAt: new Date("2026-07-01T00:00:00Z") });
    await postRepo.pinPost({ id: posts[1]!.id, pinnedAt: new Date("2026-07-05T00:00:00Z") });
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual([
      "newer-pin",
      "older-pin",
      "normal",
    ]);
  });

  it("pin された post は 2 ページ目には重複して表示されない（#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const posts = [];
    for (let i = 0; i < 4; i++) {
      const [created] = await postRepo.createMany("community-1", [
        { slotKey: "s", seq: i, author: "w", title: `P${i}`, text: "t" },
      ]);
      posts.push(created!);
      await new Promise((r) => setTimeout(r, 2));
    }
    // 最新の post（P3）を pin する。
    await postRepo.pinPost({ id: posts[3]!.id, pinnedAt: new Date() });
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res1 = await request(app).get("/api/communities/technology/feed?limit=2");
    expect(res1.status).toBe(200);
    // 1 ページ目: pin (P3) + 通常 2 件（P3 は通常枠から除外されるため P2, P1）
    expect(res1.body.posts.map((p: { title: string }) => p.title)).toEqual(["P3", "P2", "P1"]);

    const res2 = await request(app).get(
      `/api/communities/technology/feed?limit=2&cursor=${res1.body.nextCursor}`,
    );
    expect(res2.status).toBe(200);
    // 2 ページ目に P3 が重複して現れないこと
    expect(res2.body.posts.map((p: { title: string }) => p.title)).toEqual(["P0"]);
  });

  it("pin が 0 件の community では従来どおりの表示になる（#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "P0", text: "t" },
    ]);
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual(["P0"]);
    expect(res.body.posts[0]).toMatchObject({ is_pinned: false });
  });

  it("ドリップ配信で未公開（createdAt が未来）の pin 済み post は先頭表示されない（ADR-0034・#1089）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const posts = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "revealed", text: "t" },
      {
        slotKey: "s",
        seq: 1,
        author: "w",
        title: "not-yet-revealed",
        text: "t",
        createdAt: new Date("2999-01-01T00:00:00Z"),
      },
    ]);
    await postRepo.pinPost({ id: posts[0]!.id, pinnedAt: new Date() });
    await postRepo.pinPost({ id: posts[1]!.id, pinnedAt: new Date() });
    const deps = await createTestDeps({ communityRepository: communityRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/communities/technology/feed");
    expect(res.status).toBe(200);
    const titles = res.body.posts.map((p: { title: string }) => p.title);
    expect(titles).toContain("revealed");
    expect(titles).not.toContain("not-yet-revealed");
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
  it("未認証ユーザーは subscribed: false, notify_enabled: true が返る（#1088）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/subscription");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false, notify_enabled: true });
  });

  it("認証済みで未購読の場合は subscribed: false, notify_enabled: true が返る（#1088）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .get("/api/communities/technology/subscription")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: false, notify_enabled: true });
  });

  it("購読後は subscribed: true, notify_enabled: true（デフォルト）が返る（#1088）", async () => {
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
    expect(res.body).toEqual({ subscribed: true, notify_enabled: true });
  });

  it("notifyEnabled を false にした後は notify_enabled: false が返る（#1088）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    await request(app).post("/api/communities/technology/subscribe").set("Cookie", cookie);
    await request(app)
      .patch("/api/communities/technology/subscription")
      .set("Cookie", cookie)
      .send({ notify_enabled: false });

    const res = await request(app)
      .get("/api/communities/technology/subscription")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscribed: true, notify_enabled: false });
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/not-exists/subscription");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/communities/:slug/subscription（#1088）", () => {
  it("購読済みユーザーは notify_enabled を更新でき 204 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];
    await request(app).post("/api/communities/technology/subscribe").set("Cookie", cookie);

    const res = await request(app)
      .patch("/api/communities/technology/subscription")
      .set("Cookie", cookie)
      .send({ notify_enabled: false });
    expect(res.status).toBe(204);
  });

  it("未購読ユーザーは 403 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .patch("/api/communities/technology/subscription")
      .set("Cookie", cookie)
      .send({ notify_enabled: false });
    expect(res.status).toBe(403);
  });

  it("未認証は 401 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);

    const res = await request(app)
      .patch("/api/communities/technology/subscription")
      .send({ notify_enabled: false });
    expect(res.status).toBe(401);
  });

  it("存在しないコミュニティは 404 が返る", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .patch("/api/communities/not-exists/subscription")
      .set("Cookie", cookie)
      .send({ notify_enabled: false });
    expect(res.status).toBe(404);
  });

  it("notify_enabled が真偽値でないボディは 400 が返る", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const subscriptionRepo = createInMemorySubscriptionRepository();
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      subscriptionRepository: subscriptionRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];
    await request(app).post("/api/communities/technology/subscribe").set("Cookie", cookie);

    const res = await request(app)
      .patch("/api/communities/technology/subscription")
      .set("Cookie", cookie)
      .send({ notify_enabled: "yes" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/communities/:slug/workers（#1078）", () => {
  it("community に紐づく全ワーカーを返す（投稿の有無に関係なく所属ワーカー全員）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository({
      workers: [
        { id: "worker-1", displayName: "Haru", role: "ムードメーカー", personality: null, imageUrl: null, deletedAt: null },
        { id: "worker-2", displayName: "Ken", role: "ベテラン", personality: null, imageUrl: null, deletedAt: null },
      ],
      links: [
        { workerId: "worker-1", communityId: "community-1" },
        { workerId: "worker-2", communityId: "community-1" },
      ],
    });
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      workerCommunityRepository: workerCommunityRepo,
    });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/workers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("nextCursor");
    const ids = (res.body.items as { id: string }[]).map((w) => w.id);
    expect(ids).toEqual(["worker-1", "worker-2"]);
  });

  it("limit を指定するとページネーションされ nextCursor が設定される", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    // eslint-disable-next-line max-params
    const workers = Array.from({ length: 3 }, (_, i) => ({
      id: `w${i}`,
      displayName: `worker-${i}`,
      role: null,
      personality: null,
      imageUrl: null,
      deletedAt: null,
    }));
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository({
      workers,
      links: workers.map((w) => ({ workerId: w.id, communityId: "community-1" })),
    });
    const deps = await createTestDeps({
      communityRepository: communityRepo,
      workerCommunityRepository: workerCommunityRepo,
    });
    const app = createApp(deps);

    const res1 = await request(app).get("/api/communities/technology/workers?limit=2");
    expect(res1.status).toBe(200);
    expect(res1.body.items).toHaveLength(2);
    expect(res1.body.nextCursor).not.toBeNull();

    const res2 = await request(app).get(
      `/api/communities/technology/workers?limit=2&cursor=${res1.body.nextCursor}`,
    );
    expect(res2.status).toBe(200);
    expect(res2.body.items).toHaveLength(1);
    expect(res2.body.nextCursor).toBeNull();
  });

  it("認証なしでアクセスできる（公開 API）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/workers");
    expect(res.status).toBe(200);
  });

  it("紐づくワーカーがない community は items: [] を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/workers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("存在しない slug は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/not-exists/workers");
    expect(res.status).toBe(404);
  });

  it("不正な cursor は 400 を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get(
      "/api/communities/technology/workers?cursor=not-base64-json",
    );
    expect(res.status).toBe(400);
  });

  it("旧 GET /api/communities/:slug/recent-workers は削除されている（404）", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const deps = await createTestDeps({ communityRepository: communityRepo });
    const app = createApp(deps);
    const res = await request(app).get("/api/communities/technology/recent-workers");
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
