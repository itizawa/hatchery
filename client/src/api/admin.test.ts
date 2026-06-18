import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_WORKERS_QUERY_KEY,
  fetchSettings,
  patchSetting,
  useCreateAdminWorker,
  useDeleteWorker,
} from "./admin.js";
import { BOT_WORKERS_QUERY_KEY } from "./workers.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      QueryClientProvider({ client: queryClient, children }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// #110: admin の HTTP 呼び出しを openApiClient（生成型・ baseUrl 解決）経由に統一する。
// 生の相対 fetch だとクロスオリジン配信（#78）で baseUrl が前置されず壊れるため、
// fetch に Request オブジェクト（絶対 URL）が渡ること＝openApiClient 経由であることを検証する。
describe("admin API（openApiClient 経由・絶対 URL）", () => {
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

describe("useCreateAdminWorker (POST /api/admin/workers)", () => {
  it("成功後に ADMIN_WORKERS_QUERY_KEY と BOT_WORKERS_QUERY_KEY を invalidate する", async () => {
    const newWorker = {
      id: "worker-1",
      displayName: "新ワーカー",
      role: "テスター",
      personality: null,
      imageUrl: null,
      deletedAt: null,
      lastAppearedSlotKey: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, newWorker)));

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAdminWorker(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ displayName: "新ワーカー", role: "テスター" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ADMIN_WORKERS_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BOT_WORKERS_QUERY_KEY });
  });

  it("非 2xx のとき mutation が reject する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "Bad Request" })));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAdminWorker(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ displayName: "失敗ワーカー" });
      }),
    ).rejects.toThrow();
  });
});

describe("useDeleteWorker (DELETE /api/admin/workers/:id)", () => {
  it("成功後に ADMIN_WORKERS_QUERY_KEY と BOT_WORKERS_QUERY_KEY を invalidate する", async () => {
    const deleted = { id: "worker-1", deletedAt: "2026-06-18T00:00:00.000Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, deleted)));

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteWorker(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("worker-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ADMIN_WORKERS_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BOT_WORKERS_QUERY_KEY });
  });

  it("非 2xx のとき mutation が reject する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not Found" })));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteWorker(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync("nonexistent-worker");
      }),
    ).rejects.toThrow();
  });
});
