import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Suspense, type ReactElement, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOT_WORKERS_QUERY_KEY,
  uploadWorkerImage,
  useAllBotWorkers,
  useBotWorkers,
  useUpdateWorker,
  useUploadWorkerImage,
} from "./workers.js";

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

/**
 * Suspense クエリ用の wrapper。`useSuspenseQuery` は取得中に throw して Suspend し、
 * 失敗時にエラーを throw するため、`<Suspense>` + `ErrorBoundary` で包む必要がある。
 * `errors` 配列に捕捉したエラーを push して、テストから失敗を観測できるようにする。
 */
function createSuspenseWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const errors: Error[] = [];
  return {
    queryClient,
    errors,
    wrapper: ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary
          fallbackRender={({ error }: { error: unknown }) => {
            errors.push(error as Error);
            return <div data-testid="suspense-error" />;
          }}
        >
          <Suspense fallback={<div data-testid="suspense-loading" />}>{children}</Suspense>
        </ErrorBoundary>
      </QueryClientProvider>
    ),
  };
}

const mockWorker = {
  id: "worker-haru",
  displayName: "haru",
  role: "ムードメーカー",
  imageUrl: null,
  deletedAt: null,
  personality: null,
  lastAppearedSlotKey: null,
};

describe("useBotWorkers (GET /api/workers, useSuspenseQuery)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき Worker 配列を data として解決する（data は undefined を取らない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [mockWorker])));
    const { wrapper } = createSuspenseWrapper();
    const { result } = renderHook(() => useBotWorkers(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([mockWorker]));
  });

  it("エラー応答のとき throw され ErrorBoundary に捕捉される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Server Error" })));
    const { wrapper, errors } = createSuspenseWrapper();
    renderHook(() => useBotWorkers(), { wrapper });

    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0]).toBeInstanceOf(Error);
  });
});

describe("useAllBotWorkers (GET /api/workers, useSuspenseQuery)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき Worker 配列を data として解決する（data は undefined を取らない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [mockWorker])));
    const { wrapper } = createSuspenseWrapper();
    const { result } = renderHook(() => useAllBotWorkers(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([mockWorker]));
  });

  it("エラー応答のとき throw され ErrorBoundary に捕捉される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Server Error" })));
    const { wrapper, errors } = createSuspenseWrapper();
    renderHook(() => useAllBotWorkers(), { wrapper });

    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0]).toBeInstanceOf(Error);
  });
});

describe("useUpdateWorker (PATCH /api/workers/{id})", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正しい path/body で PATCH が呼ばれ、成功後に BOT_WORKERS_QUERY_KEY を invalidate する", async () => {
    const updatedWorker = { ...mockWorker, displayName: "updated-haru" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updatedWorker));
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateWorker(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "worker-haru",
        body: { displayName: "updated-haru" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(updatedWorker);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/workers/worker-haru");
    expect(request.method).toBe("PATCH");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BOT_WORKERS_QUERY_KEY });
  });

  it("非 2xx のとき mutation が reject する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" })));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateWorker(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          id: "worker-haru",
          body: { displayName: "updated-haru" },
        });
      }),
    ).rejects.toThrow();
  });
});

describe("uploadWorkerImage (POST /api/admin/workers/{id}/image)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("multipart/form-data で POST し { id, imageUrl } を返す", async () => {
    const mockResponse = { id: "worker-haru", imageUrl: "https://example.com/image.png" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, mockResponse));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["dummy content"], "avatar.png", { type: "image/png" });
    const result = await uploadWorkerImage("worker-haru", file);

    expect(result).toEqual(mockResponse);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/admin/workers/worker-haru/image");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("非 2xx のときエラーメッセージを throw する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(413, { error: "File too large" })),
    );

    const file = new File(["dummy content"], "avatar.png", { type: "image/png" });
    await expect(uploadWorkerImage("worker-haru", file)).rejects.toThrow("File too large");
  });
});

describe("useUploadWorkerImage (useMutation wrapper)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功後に BOT_WORKERS_QUERY_KEY を invalidate する", async () => {
    const mockResponse = { id: "worker-haru", imageUrl: "https://example.com/image.png" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, mockResponse)));

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadWorkerImage(), { wrapper });

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    await act(async () => {
      await result.current.mutateAsync({ workerId: "worker-haru", file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BOT_WORKERS_QUERY_KEY });
  });
});
