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
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "My Post" });
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
    expect(res.body).toHaveLength(2);
  });

  it("投稿が 0 件のときは空配列を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
