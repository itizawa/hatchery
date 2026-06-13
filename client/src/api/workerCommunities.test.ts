import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWorkerCommunities, setWorkerCommunities } from "./workerCommunities.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchWorkerCommunities (GET /api/admin/workers/:id/communities) (#490)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき参加コミュニティ id 配列を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { communityIds: ["c1", "c2"] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorkerCommunities("haru");
    expect(result).toEqual(["c1", "c2"]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/workers/haru/communities");
    expect(request.method).toBe("GET");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchWorkerCommunities("missing")).rejects.toThrow();
  });
});

describe("setWorkerCommunities (PUT /api/admin/workers/:id/communities) (#490)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき置換後の id 配列を返し PUT で送信する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { communityIds: ["c1"] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await setWorkerCommunities("haru", ["c1"]);
    expect(result).toEqual(["c1"]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/workers/haru/communities");
    expect(request.method).toBe("PUT");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400)));
    await expect(setWorkerCommunities("haru", ["bad"])).rejects.toThrow();
  });
});
