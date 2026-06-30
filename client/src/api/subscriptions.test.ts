import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeCommunity, unsubscribeCommunity, fetchSubscriptionStatus, fetchUnreadCounts, markCommunityViewed } from "./subscriptions.js";

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

describe("fetchSubscriptionStatus (GET /api/communities/{slug}/subscription)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 + { subscribed: true } のとき { subscribed: true } を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { subscribed: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSubscriptionStatus("ai-dev");
    expect(result).toEqual({ subscribed: true });
  });

  it("200 + { subscribed: false } のとき { subscribed: false } を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { subscribed: false }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSubscriptionStatus("ai-dev");
    expect(result).toEqual({ subscribed: false });
  });

  it("4xx のとき例外を throw する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(fetchSubscriptionStatus("ai-dev")).rejects.toThrow();
  });

  it("5xx のとき例外を throw する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(fetchSubscriptionStatus("ai-dev")).rejects.toThrow();
  });

  it("slug に特殊文字が含まれる場合 URL に encodeURIComponent が適用される", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { subscribed: false }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSubscriptionStatus("スラッグ/test");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent("スラッグ/test"));
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
