import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import type { VoteRepository } from "../persistence/voteRepository.js";

const COMMUNITY: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "Technology",
  description: "desc",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
  feedUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

/**
 * post 1 件・comment 1 件を用意し、voteRepository を紐付けて buildApp する。
 * createTestDeps に postRepository/commentRepository/communityRepository を渡すと
 * trendingItemsSince 用の resolveTrendingTargetMeta が自動で組み立てられる（#1065）。
 */
async function buildAppWithTrendingFixtures(): Promise<{
  app: ReturnType<typeof createApp>;
  voteRepository: VoteRepository;
  postId: string;
  commentId: string;
}> {
  const postRepository = createInMemoryPostRepository();
  const commentRepository = createInMemoryCommentRepository();
  const communityRepository = createInMemoryCommunityRepository([COMMUNITY]);

  const [post] = await postRepository.createMany(COMMUNITY.id, [
    { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "t1", text: "post の本文冒頭です" },
  ]);
  const [comment] = await commentRepository.createMany(COMMUNITY.id, [
    { postId: post!.id, slotKey: "2026-06-10T09:00", seq: 0, author: "w2", text: "comment の本文冒頭です" },
  ]);

  const deps = createTestDeps({ postRepository, commentRepository, communityRepository });
  const app = createApp(deps);
  return { app, voteRepository: deps.voteRepository, postId: post!.id, commentId: comment!.id };
}

describe("GET /api/ranking/trending（トレンド Post/Comment・#1065）", () => {
  it("認証不要で 200 を返し items 配列を含む", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("データがない場合は items: [] を返す（空状態）", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("post への vote を集計し type/id/post_id/excerpt/community_id/community_slug/net_score/created_at を含むアイテムを返す", async () => {
    const { app, voteRepository, postId } = await buildAppWithTrendingFixtures();
    await voteRepository.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: postId, direction: "up" });

    const res = await request(app).get("/api/ranking/trending");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.type).toBe("post");
    expect(item.id).toBe(postId);
    expect(item.post_id).toBe(postId);
    expect(item.excerpt).toBe("post の本文冒頭です");
    expect(item.community_id).toBe(COMMUNITY.id);
    expect(item.community_slug).toBe(COMMUNITY.slug);
    expect(item.net_score).toBe(1);
    expect(typeof item.created_at).toBe("string");
  });

  it("comment への vote は type: comment・post_id に親 post の id を持つアイテムを返す", async () => {
    const { app, voteRepository, commentId, postId } = await buildAppWithTrendingFixtures();
    await voteRepository.vote({ sessionId: "s1", userId: null, targetType: "comment", targetId: commentId, direction: "up" });

    const res = await request(app).get("/api/ranking/trending");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ type: "comment", id: commentId, post_id: postId });
  });

  it("limit を指定すると件数を制限する", async () => {
    const postRepository = createInMemoryPostRepository();
    const commentRepository = createInMemoryCommentRepository();
    const communityRepository = createInMemoryCommunityRepository([COMMUNITY]);
    const posts = await postRepository.createMany(COMMUNITY.id, [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "t1", text: "post1" },
      { slotKey: "2026-06-10T09:00", seq: 1, author: "w1", title: "t2", text: "post2" },
    ]);
    const deps = createTestDeps({ postRepository, commentRepository, communityRepository });
    await deps.voteRepository.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: posts[0]!.id, direction: "up" });
    await deps.voteRepository.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: posts[1]!.id, direction: "up" });
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending?limit=1");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("limit=20（最大値）は 200 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending?limit=20");

    expect(res.status).toBe(200);
  });

  it("limit=21（最大値超過）は 400 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending?limit=21");

    expect(res.status).toBe(400);
  });

  it("limit=0（最小値未満）は 400 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending?limit=0");

    expect(res.status).toBe(400);
  });

  it("limit が数値でない場合は 400 を返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending?limit=abc");

    expect(res.status).toBe(400);
  });

  it("limit 省略時は既定 10 件までを返す", async () => {
    const deps = createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/ranking/trending");

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
  });
});
