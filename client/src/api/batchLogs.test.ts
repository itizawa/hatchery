import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBatchLogs } from "./batchLogs.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleLog = {
  id: "b1",
  executedAt: "2026-01-01T00:00:00Z",
  status: "success",
  messageCount: 3,
  errorMessage: null,
  errorCode: null,
};

// #110: batchLogs の HTTP 呼び出しを openApiClient（生成型・baseUrl 解決）経由に統一する。
// 生の相対 fetch だとクロスオリジン配信（#78）で baseUrl が前置されず壊れる。
// BatchRunLogSchema による現行のランタイム検証（executedAt の Date 化）は維持する。
describe("batchLogs API（openApiClient 経由・絶対 URL）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchBatchLogs は openApiClient 経由で /admin/batch-logs を GET する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [sampleLog]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBatchLogs();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/admin/batch-logs");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("GET");
  });

  it("fetchBatchLogs は BatchRunLogSchema で検証し executedAt を Date 化する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [sampleLog])));

    const logs = await fetchBatchLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("b1");
    expect(logs[0].executedAt).toBeInstanceOf(Date);
  });

  it("fetchBatchLogs は非 2xx で例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Internal" })));
    await expect(fetchBatchLogs()).rejects.toThrow();
  });
});
