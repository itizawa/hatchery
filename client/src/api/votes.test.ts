import { afterEach, describe, expect, it, vi } from "vitest";

import { votePost, voteComment } from "./votes.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
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
