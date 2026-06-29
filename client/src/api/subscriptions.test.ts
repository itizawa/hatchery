import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeCommunity, unsubscribeCommunity, fetchUnreadCounts, markCommunityViewed } from "./subscriptions.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("fetchUnreadCounts (GET /api/subscriptions/unread-counts)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき unread_counts 配列を返す", async () => {
    const mockData = {
      unread_counts: [
        { community_id: "community-1", community_slug: "ai-dev", unread_count: 5, last_viewed_at: null },
        { community_id: "community-2", community_slug: "tech-talk", unread_count: 0, last_viewed_at: null },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchUnreadCounts();
    expect(result).toEqual(mockData);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/subscriptions/unread-counts");
  });

  it("401 のとき例外を投げる", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUnreadCounts()).rejects.toThrow();
  });
});

describe("markCommunityViewed (PATCH /api/communities/{slug}/mark-viewed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき正常終了する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(markCommunityViewed("ai-dev")).resolves.toBeUndefined();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/communities/ai-dev/mark-viewed");
    expect(request.method).toBe("PATCH");
  });
});
