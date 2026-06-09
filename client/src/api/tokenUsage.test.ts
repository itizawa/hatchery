import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTokenUsage } from "./tokenUsage.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleLog = {
  id: "t1",
  occurredAt: "2026-01-01T00:00:00Z",
  model: "claude-haiku-4-5",
  inputTokens: 100,
  outputTokens: 50,
  batchRunLogId: null,
};

const sampleResponse = {
  logs: [sampleLog],
  summary: {
    totalInputTokens: 100,
    totalOutputTokens: 50,
    totalTokens: 150,
  },
};

describe("tokenUsage API（openApiClient 経由）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchTokenUsage は openApiClient 経由で /admin/token-usage を GET する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTokenUsage();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toContain("/admin/token-usage");
    expect(request.url).toMatch(/^https?:\/\//);
    expect(request.method).toBe("GET");
  });

  it("fetchTokenUsage は TokenUsageLogSchema で検証し occurredAt を Date 化する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse)));

    const result = await fetchTokenUsage();
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].id).toBe("t1");
    expect(result.logs[0].occurredAt).toBeInstanceOf(Date);
    expect(result.summary.totalInputTokens).toBe(100);
    expect(result.summary.totalOutputTokens).toBe(50);
    expect(result.summary.totalTokens).toBe(150);
  });

  it("fetchTokenUsage は非 2xx で例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
    await expect(fetchTokenUsage()).rejects.toThrow();
  });
});
