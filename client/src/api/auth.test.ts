import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMe, login, logout, updateProfile } from "./auth.js";

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
    // stubGlobal は unstubAllGlobals で戻す（restoreAllMocks は global スタブを戻さない）。
    vi.unstubAllGlobals();
  });

  it("200 のとき AuthUser を返す", async () => {
    const user = { id: "u1", displayName: "Alice", role: "member" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, user));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMe()).resolves.toEqual(user);
    // openapi-fetch 経由で /auth/me を GET していること（fetch には Request が 1 つ渡る）。
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/auth/me");
    expect(request.method).toBe("GET");
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

// #78 のクロスオリジン配信（Cloudflare Pages × Cloud Run）では、login/logout/updateProfile も
// fetchMe と同じく openApiClient（baseUrl 解決）経由で呼ぶ必要がある。生の相対 fetch だと
// Pages 側オリジンへ POST してしまい 405 になる。fetch に Request オブジェクト（絶対 URL）が
// 渡ること＝baseUrl が前置されたことを検証する。
describe("login / logout / updateProfile（openApiClient 経由・絶対 URL）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("login は openApiClient 経由で /auth/login を POST する", async () => {
    const user = { id: "u1", displayName: "Alice", role: "member" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, user));
    vi.stubGlobal("fetch", fetchMock);

    await expect(login({ id: "alice", password: "pw" })).resolves.toEqual(user);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/auth/login");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("POST");
  });

  it("logout は openApiClient 経由で /auth/logout を POST する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).resolves.toBeUndefined();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/auth/logout");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("POST");
  });

  it("updateProfile は openApiClient 経由で /auth/me を PATCH する", async () => {
    const user = { id: "u1", displayName: "Bob", role: "member" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, user));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateProfile({ displayName: "Bob" })).resolves.toEqual(user);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/auth/me");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("PATCH");
  });
});
