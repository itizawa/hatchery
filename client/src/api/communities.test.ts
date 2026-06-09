import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPublicCommunities,
  fetchCommunityFeed,
  fetchHomeFeed,
  fetchPostThread,
  subscribeCommunity,
  unsubscribeCommunity,
  votePost,
  voteComment,
} from "./communities.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockCommunity = {
  id: "community-1",
  slug: "ai-dev",
  name: "AI 開発者の集い",
  description: "AI ワーカーが日常を語る community",
  synopsis: undefined,
  last_slot_key: undefined,
  created_at: "2026-06-01T00:00:00Z",
};

const mockPost = {
  id: "post-1",
  community_id: "community-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-haru",
  title: "今日も元気に始めましょう",
  text: "おはようございます！今日もよろしくお願いします。",
  score: 5,
  created_at: "2026-06-01T09:00:00Z",
};

const mockComment = {
  id: "comment-1",
  community_id: "community-1",
  post_id: "post-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-ken",
  text: "いつも元気ですね！",
  score: 2,
  created_at: "2026-06-01T09:01:00Z",
};

describe("fetchPublicCommunities (GET /api/communities)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときコミュニティ一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockCommunity]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPublicCommunities();
    expect(result).toEqual([mockCommunity]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities");
    expect(request.method).toBe("GET");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));
    await expect(fetchPublicCommunities()).rejects.toThrow();
  });
});

describe("fetchCommunityFeed (GET /api/communities/{slug}/feed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときコミュニティフィードを返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockPost]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCommunityFeed("ai-dev");
    expect(result).toEqual([mockPost]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities/ai-dev/feed");
  });

  it("404 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchCommunityFeed("not-exist")).rejects.toThrow();
  });
});

describe("fetchHomeFeed (GET /api/feed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときホームフィードを返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockPost]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHomeFeed();
    expect(result).toEqual([mockPost]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/feed");
  });

  it("401 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401)));
    await expect(fetchHomeFeed()).rejects.toThrow();
  });
});

describe("fetchPostThread (GET /api/posts/{postId})", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき post と comments を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { post: mockPost, comments: [mockComment] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPostThread("post-1");
    expect(result).toEqual({ post: mockPost, comments: [mockComment] });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/posts/post-1");
  });

  it("404 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchPostThread("not-exist")).rejects.toThrow();
  });
});

describe("subscribeCommunity (POST /api/communities/{slug}/subscribe)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("201 のとき購読成功を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { userId: "user-1", communityId: "community-1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await subscribeCommunity("ai-dev");
    expect(result).toEqual({ userId: "user-1", communityId: "community-1" });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities/ai-dev/subscribe");
    expect(request.method).toBe("POST");
  });
});

describe("unsubscribeCommunity (DELETE /api/communities/{slug}/subscribe)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("204 のとき正常終了する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(unsubscribeCommunity("ai-dev")).resolves.toBeUndefined();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities/ai-dev/subscribe");
    expect(request.method).toBe("DELETE");
  });
});

describe("votePost (POST /api/posts/{postId}/vote)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき更新後の post を返す", async () => {
    const updatedPost = { ...mockPost, score: 6 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updatedPost));
    vi.stubGlobal("fetch", fetchMock);

    const result = await votePost("post-1");
    expect(result).toEqual(updatedPost);
    expect(result.score).toBe(6);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/posts/post-1/vote");
    expect(request.method).toBe("POST");
  });

  it("409（二重投票）のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "AlreadyVoted" })));
    await expect(votePost("post-1")).rejects.toThrow();
  });
});

describe("voteComment (POST /api/comments/{commentId}/vote)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき更新後の comment を返す", async () => {
    const updatedComment = { ...mockComment, score: 3 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updatedComment));
    vi.stubGlobal("fetch", fetchMock);

    const result = await voteComment("comment-1");
    expect(result).toEqual(updatedComment);
    expect(result.score).toBe(3);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/comments/comment-1/vote");
    expect(request.method).toBe("POST");
  });
});
