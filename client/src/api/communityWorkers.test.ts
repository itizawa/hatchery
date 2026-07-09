import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCommunityWorkerAssignments, setCommunityWorkerAssignments } from "./communityWorkers.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchCommunityWorkerAssignments (GET /api/admin/communities/:id/workers) (#1079)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき所属ワーカー一覧を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { workers: [{ id: "haru", displayName: "haru" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCommunityWorkerAssignments("community-1");
    expect(result).toEqual([{ id: "haru", displayName: "haru" }]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/communities/community-1/workers");
    expect(request.method).toBe("GET");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404)));
    await expect(fetchCommunityWorkerAssignments("missing")).rejects.toThrow();
  });
});

describe("setCommunityWorkerAssignments (PUT /api/admin/communities/:id/workers) (#1079)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき置換後の一覧を返し PUT で送信する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { workers: [{ id: "haru", displayName: "haru" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await setCommunityWorkerAssignments({
      communityId: "community-1",
      workerIds: ["haru"],
    });
    expect(result).toEqual([{ id: "haru", displayName: "haru" }]);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/admin/communities/community-1/workers");
    expect(request.method).toBe("PUT");
  });

  it("エラー応答では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400)));
    await expect(
      setCommunityWorkerAssignments({ communityId: "community-1", workerIds: ["bad"] }),
    ).rejects.toThrow();
  });
});
