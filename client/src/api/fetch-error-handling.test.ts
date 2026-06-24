/**
 * fetch エラーハンドリング統一（Issue #788）の受け入れテスト。
 * 各 API 関数が unwrap / ensureOk ヘルパー経由で "(status)" 形式の
 * エラーを投げることを検証する。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCommunityFeed, fetchHomeFeedPage } from "./feed.js";
import { fetchPostThread } from "./posts.js";
import { subscribeCommunity, unsubscribeCommunity } from "./subscriptions.js";
import { voteComment, votePost } from "./votes.js";

function jsonResponse({ status, body }: { status: number; body?: unknown }): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── votePost ─────────────────────────────────────────────────────────────────

describe("votePost", () => {
  const mockPost = {
    id: "p1",
    title: "title",
    body: "",
    score: 0,
    my_vote: null,
    communityId: "c1",
    workerId: "w1",
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  it("200 のとき Post を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockPost })));
    const result = await votePost({ postId: "p1", direction: "up", sessionId: "s1" });
    expect(result).toEqual(mockPost);
  });

  it('500 のとき "POST /api/posts/p1/vote (500)" 形式で throw する（AC1）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(votePost({ postId: "p1", direction: "up", sessionId: "s1" })).rejects.toThrow(
      "POST /api/posts/p1/vote (500)",
    );
  });
});

// ─── voteComment ──────────────────────────────────────────────────────────────

describe("voteComment", () => {
  const mockComment = {
    id: "c1",
    body: "comment",
    score: 0,
    my_vote: null,
    postId: "p1",
    workerId: "w1",
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  it("200 のとき Comment を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockComment })));
    const result = await voteComment({ commentId: "c1", direction: "up", sessionId: "s1" });
    expect(result).toEqual(mockComment);
  });

  it('500 のとき "POST /api/comments/c1/vote (500)" 形式で throw する（AC2）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(
      voteComment({ commentId: "c1", direction: "up", sessionId: "s1" }),
    ).rejects.toThrow("POST /api/comments/c1/vote (500)");
  });
});

// ─── fetchCommunityFeed ───────────────────────────────────────────────────────

describe("fetchCommunityFeed", () => {
  const mockPosts = [
    {
      id: "p1",
      title: "title",
      body: "",
      score: 0,
      my_vote: null,
      communityId: "c1",
      workerId: "w1",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  it("200 のとき Post[] を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockPosts })));
    const result = await fetchCommunityFeed({ slug: "tech" });
    expect(result).toEqual(mockPosts);
  });

  it('500 のとき "GET /api/communities/tech/feed (500)" 形式で throw する（AC3）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(fetchCommunityFeed({ slug: "tech" })).rejects.toThrow(
      "GET /api/communities/tech/feed (500)",
    );
  });
});

// ─── fetchHomeFeedPage ────────────────────────────────────────────────────────

describe("fetchHomeFeedPage", () => {
  const mockFeedPage = {
    posts: [],
    nextCursor: null,
  };

  it("200 のとき pages を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockFeedPage })));
    const result = await fetchHomeFeedPage();
    expect(result).toEqual(mockFeedPage);
  });

  it('500 のとき "GET /api/feed (500)" 形式で throw する（AC4）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(fetchHomeFeedPage()).rejects.toThrow("GET /api/feed (500)");
  });
});

// ─── subscribeCommunity ───────────────────────────────────────────────────────

describe("subscribeCommunity", () => {
  const mockSubscription = { userId: "u1", communityId: "c1" };

  it("200 のとき data を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockSubscription })));
    const result = await subscribeCommunity("tech");
    expect(result).toEqual(mockSubscription);
  });

  it('500 のとき "POST /api/communities/tech/subscribe (500)" 形式で throw する（AC5）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(subscribeCommunity("tech")).rejects.toThrow(
      "POST /api/communities/tech/subscribe (500)",
    );
  });
});

// ─── unsubscribeCommunity ─────────────────────────────────────────────────────

describe("unsubscribeCommunity", () => {
  it("204 のとき throw しない（AC6）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 204 })));
    await expect(unsubscribeCommunity("tech")).resolves.toBeUndefined();
  });

  it('500 のとき "DELETE /api/communities/tech/subscribe (500)" 形式で throw する（AC7）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(unsubscribeCommunity("tech")).rejects.toThrow(
      "DELETE /api/communities/tech/subscribe (500)",
    );
  });
});

// ─── fetchPostThread ──────────────────────────────────────────────────────────

describe("fetchPostThread", () => {
  const mockThread = {
    post: {
      id: "p1",
      title: "title",
      body: "",
      score: 0,
      my_vote: null,
      communityId: "c1",
      workerId: "w1",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    comments: [],
  };

  it("200 のとき thread を返す（AC9）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockThread })));
    const result = await fetchPostThread({ postId: "p1" });
    expect(result).toEqual(mockThread);
  });

  it('500 のとき "GET /api/posts/p1 (500)" 形式で throw する（AC8）', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: 500 })));
    await expect(fetchPostThread({ postId: "p1" })).rejects.toThrow("GET /api/posts/p1 (500)");
  });
});
