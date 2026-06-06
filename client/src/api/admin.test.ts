import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSettings, patchSetting } from "./admin.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// #110: admin の HTTP 呼び出しを openApiClient（生成型・baseUrl 解決）経由に統一する。
// 生の相対 fetch だとクロスオリジン配信（#78）で baseUrl が前置されず壊れるため、
// fetch に Request オブジェクト（絶対 URL）が渡ること＝openApiClient 経由であることを検証する。
describe("admin API（openApiClient 経由・絶対 URL）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchSettings は openApiClient 経由で /admin/settings を GET する", async () => {
    const settings = [{ key: "OPENAI_API_KEY", value: "***", updatedAt: "2026-01-01T00:00:00Z" }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, settings));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSettings()).resolves.toEqual(settings);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/admin/settings");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("GET");
  });

  it("fetchSettings は非 2xx で例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Internal" })));
    await expect(fetchSettings()).rejects.toThrow();
  });

  it("patchSetting は openApiClient 経由で /admin/settings を PATCH する", async () => {
    const updated = { key: "OPENAI_API_KEY", value: "***", updatedAt: "2026-01-01T00:00:00Z" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updated));
    vi.stubGlobal("fetch", fetchMock);

    await expect(patchSetting("OPENAI_API_KEY", "sk-xxx")).resolves.toEqual(updated);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/admin/settings");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("PATCH");
  });

  it("patchSetting は非 2xx で例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "Bad Request" })));
    await expect(patchSetting("OPENAI_API_KEY", "sk-xxx")).rejects.toThrow();
  });
});
