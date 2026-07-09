import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTrendingItems } from "./ranking.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockTrendingPost = {
  type: "post" as const,
  id: "post-1",
  post_id: "post-1",
  excerpt: "本文冒頭のプレビュー",
  community_id: "community-1",
  community_slug: "technology",
  net_score: 5,
  created_at: "2026-07-01T09:00:00.000Z",
};

describe("fetchTrendingItems (GET /api/ranking/trending)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときトレンドアイテム一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [mockTrendingPost] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTrendingItems();

    expect(result).toEqual([mockTrendingPost]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/ranking/trending");
  });

  it("items が空配列のとき空配列を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [] })));

    const result = await fetchTrendingItems();

    expect(result).toEqual([]);
  });

  it("500 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));
    await expect(fetchTrendingItems()).rejects.toThrow();
  });
});
