import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDashboardSummary } from "./dashboard.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockDashboardSummary = {
  community_count: 2,
  worker_count: 3,
  post_count: 10,
  comment_count: 20,
  total_view_count: 300,
  total_vote_count: 40,
  total_subscription_count: 5,
  communities: [
    {
      community_id: "community-1",
      slug: "tech",
      name: "Technology",
      post_count: 6,
      subscriber_count: 3,
      view_count: 200,
    },
    {
      community_id: "community-2",
      slug: "news",
      name: "News",
      post_count: 4,
      subscriber_count: 2,
      view_count: 100,
    },
  ],
};

describe("fetchDashboardSummary (GET /api/dashboard)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のときダッシュボードサマリを返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, mockDashboardSummary));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDashboardSummary();

    expect(result).toEqual(mockDashboardSummary);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/dashboard");
  });

  it("500 のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500)));
    await expect(fetchDashboardSummary()).rejects.toThrow();
  });
});
