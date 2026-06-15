import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeCommunity, unsubscribeCommunity } from "./subscriptions.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
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
