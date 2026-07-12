import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPostThread, pinPost, unpinPost } from "./posts.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("fetchPostThread (GET /api/posts/{postId})", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき post と comments を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { post: mockPost, comments: [mockComment] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPostThread({ postId: "post-1" });
    expect(result).toEqual({ post: mockPost, comments: [mockComment] });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/posts/post-1");
  });

  it("404 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchPostThread({ postId: "not-exist" })).rejects.toThrow();
  });
});

describe("pinPost (POST /api/admin/posts/{id}/pin・#1089)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき is_pinned: true の post を返す", async () => {
    const pinned = { ...mockPost, is_pinned: true, pinned_at: "2026-07-11T00:00:00Z" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, pinned));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pinPost("post-1");
    expect(result).toEqual(pinned);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/posts/post-1/pin");
    expect(request.method).toBe("POST");
  });

  it("409 のとき例外を投げる（pin 上限超過）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "PostPinLimitExceeded" })));
    await expect(pinPost("post-1")).rejects.toThrow();
  });
});

describe("unpinPost (DELETE /api/admin/posts/{id}/pin・#1089)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき is_pinned: false の post を返す", async () => {
    const unpinned = { ...mockPost, is_pinned: false, pinned_at: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, unpinned));
    vi.stubGlobal("fetch", fetchMock);

    const result = await unpinPost("post-1");
    expect(result).toEqual(unpinned);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/posts/post-1/pin");
    expect(request.method).toBe("DELETE");
  });

  it("404 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(unpinPost("not-exist")).rejects.toThrow();
  });
});
