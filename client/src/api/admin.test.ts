import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_WORKERS_QUERY_KEY,
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
