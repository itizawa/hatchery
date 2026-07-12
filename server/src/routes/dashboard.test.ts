import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemorySubscriptionRepository } from "../persistence/subscriptionRepository.js";
import { createInMemoryViewRepository } from "../persistence/viewRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

/**
 * GET /api/dashboard の route テスト（#1113）。
 * 認証不要で 200 を返すこと、Repository スタブの返り値と一致することを検証する。
 */

describe("GET /api/dashboard（認証不要のサイト全体定量サマリ・#1113）", () => {
  it("認証ヘッダなしでも 200 を返す", async () => {
    const app = createApp(createTestDeps());
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
  });

  it("データが空の場合は全カウント 0・communities: [] を返す", async () => {
    const app = createApp(createTestDeps());
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      community_count: 0,
      worker_count: 0,
      post_count: 0,
      comment_count: 0,
      total_view_count: 0,
      total_vote_count: 0,
      total_subscription_count: 0,
      communities: [],
    });
  });

  it("サイト全体サマリの各カウントが Repository の返り値と一致する", async () => {
    const communityRepository = createInMemoryCommunityRepository([
      {
        id: "community-1",
        slug: "tech",
        name: "Technology",
        description: "desc",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        feedUrl: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "community-2",
        slug: "news",
        name: "News",
        description: "desc",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        feedUrl: null,
        createdAt: new Date("2026-01-02"),
      },
    ]);
    const workerRepository = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "アリス", role: null, personality: null },
      { id: "worker-2", displayName: "ボブ", role: null, personality: null },
      { id: "worker-3", displayName: "退役済み", role: null, personality: null, deletedAt: new Date() },
    ]);
    const postRepository = createInMemoryPostRepository();
    await postRepository.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "worker-1", title: "a", text: "t" },
      { slotKey: "s", seq: 1, author: "worker-1", title: "b", text: "t" },
    ]);
    await postRepository.createMany("community-2", [
      { slotKey: "s", seq: 0, author: "worker-2", title: "c", text: "t" },
    ]);
    const commentRepository = createInMemoryCommentRepository();
    await commentRepository.createMany("community-1", [
      { postId: "p1", slotKey: "s", seq: 0, author: "worker-1", text: "comment-a" },
    ]);
    const voteRepository = createInMemoryVoteRepository();
    await voteRepository.vote({ sessionId: "s1", userId: null, targetType: "post", targetId: "p1", direction: "up" });
    await voteRepository.vote({ sessionId: "s2", userId: null, targetType: "post", targetId: "p1", direction: "up" });
    const subscriptionRepository = createInMemorySubscriptionRepository();
    await subscriptionRepository.add("user-1", "community-1");
    await subscriptionRepository.add("user-2", "community-1");
    await subscriptionRepository.add("user-3", "community-2");
    const viewRepository = createInMemoryViewRepository(
      undefined,
      undefined,
      // eslint-disable-next-line max-params
      (_type, targetId) => (targetId.startsWith("p") ? "community-1" : null),
    );
    await viewRepository.recordPostView("post-x", "sess-1", null);
    await viewRepository.recordPostView("post-x", "sess-2", null);

    const app = createApp(
      createTestDeps({
        communityRepository,
        workerRepository,
        postRepository,
        commentRepository,
        voteRepository,
        subscriptionRepository,
        viewRepository,
      }),
    );

    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.community_count).toBe(2);
    expect(res.body.worker_count).toBe(2);
    expect(res.body.post_count).toBe(3);
    expect(res.body.comment_count).toBe(1);
    expect(res.body.total_vote_count).toBe(2);
    expect(res.body.total_subscription_count).toBe(3);
    expect(res.body.total_view_count).toBe(2);
  });

  it("コミュニティ別内訳は view_count 降順でソートされる", async () => {
    const communityRepository = createInMemoryCommunityRepository([
      {
        id: "community-low",
        slug: "low",
        name: "Low Views",
        description: "desc",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        feedUrl: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "community-high",
        slug: "high",
        name: "High Views",
        description: "desc",
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: null,
        feedUrl: null,
        createdAt: new Date("2026-01-02"),
      },
    ]);
    // eslint-disable-next-line max-params
    const viewRepository = createInMemoryViewRepository(undefined, undefined, (_type, targetId) => targetId);
    await viewRepository.recordPostView("community-low", "s1", null);
    await viewRepository.recordPostView("community-high", "s1", null);
    await viewRepository.recordPostView("community-high", "s2", null);
    await viewRepository.recordPostView("community-high", "s3", null);

    const app = createApp(createTestDeps({ communityRepository, viewRepository }));
    const res = await request(app).get("/api/dashboard");

    expect(res.status).toBe(200);
    expect(res.body.communities.map((c: { community_id: string }) => c.community_id)).toEqual([
      "community-high",
      "community-low",
    ]);
    expect(res.body.communities[0]).toMatchObject({
      community_id: "community-high",
      slug: "high",
      name: "High Views",
      post_count: 0,
      subscriber_count: 0,
      view_count: 3,
    });
  });
});
