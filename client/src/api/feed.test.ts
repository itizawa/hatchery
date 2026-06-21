import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCommunityFeed, fetchHomeFeedPage } from "./feed.js";

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

describe("fetchCommunityFeed (GET /api/communities/{slug}/feed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときコミュニティフィードを返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [mockPost]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCommunityFeed({ slug: "ai-dev" });
    expect(result).toEqual([mockPost]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities/ai-dev/feed");
  });

  it("404 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchCommunityFeed({ slug: "not-exist" })).rejects.toThrow();
  });
});

describe("fetchHomeFeedPage (GET /api/feed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときホームフィードページを返す", async () => {
    const mockResponse = { posts: [mockPost], nextCursor: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, mockResponse));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHomeFeedPage();
    expect(result).toEqual(mockResponse);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/feed");
  });

  it("401 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401)));
    await expect(fetchHomeFeedPage()).rejects.toThrow();
  });

  it("sort=popular を渡すと URL に sort=popular が含まれる", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { posts: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchHomeFeedPage({ sort: "popular" });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("sort=popular");
  });

  it("sort=latest（既定）は URL に sort を含めない（後方互換）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { posts: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchHomeFeedPage();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).not.toContain("sort=");
  });
});
