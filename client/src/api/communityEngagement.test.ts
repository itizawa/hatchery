import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCommunityEngagement } from "./communityEngagement.js";

// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleResponse = {
  windowDays: 30,
  communityVotes: [{ communityId: "c1", count: 10, sharePercent: 100 }],
  workerVotes: [{ workerId: "w1", count: 10, sharePercent: 100 }],
  loyaltyScore: 0.8,
  subscriberCountByCommunity: { c1: 5 },
};

describe("communityEngagement API（openApiClient 経由）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchCommunityEngagement は openApiClient 経由で /admin/community-engagement を GET する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCommunityEngagement();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/admin/community-engagement");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("GET");
  });

  it("fetchCommunityEngagement は CommunityEngagementSchema で検証し正しい型を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse)));

    const result = await fetchCommunityEngagement();
    expect(result.windowDays).toBe(30);
    expect(result.communityVotes).toHaveLength(1);
    expect(result.communityVotes[0].communityId).toBe("c1");
    expect(result.workerVotes[0].workerId).toBe("w1");
    expect(result.loyaltyScore).toBe(0.8);
    expect(result.subscriberCountByCommunity).toEqual({ c1: 5 });
  });

  it("fetchCommunityEngagement は非 2xx で例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
    await expect(fetchCommunityEngagement()).rejects.toThrow();
  });
});
