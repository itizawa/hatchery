import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMe } from "./auth.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// #41: GET /auth/me で生成型（openapi-fetch）が end-to-end に流れることを示すテスト。
describe("fetchMe (GET /auth/me e2e 型フロー)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("200 のとき AuthUser を返す", async () => {
    const user = { id: "u1", displayName: "Alice" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, user));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMe()).resolves.toEqual(user);
    // openapi-fetch 経由で /auth/me を GET していること。
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toContain("/auth/me");
    expect(init.method).toBe("GET");
  });

  it("401（未ログイン）のとき null を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
    await expect(fetchMe()).resolves.toBeNull();
  });

  it("その他のエラー応答（500）では例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Internal" })));
    await expect(fetchMe()).rejects.toThrow();
  });
});
