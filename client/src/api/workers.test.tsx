import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Suspense, type ReactElement, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOT_WORKERS_QUERY_KEY,
  WORKER_RANKING_QUERY_KEY,
  useBotWorkers,
  useUpdateWorker,
  useUploadWorkerImage,
  useWorkerRanking,
} from "./workers.js";

// eslint-disable-next-line max-params
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { workers: [mockWorker], total: 1, page: 1, limit: 20 }),
      ),
    );
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

const mockWorkerRankingItem = {
  worker_id: "worker-haru",
  display_name: "haru",
  view_count: 42,
  vote_net_score: 10,
};

describe("useWorkerRanking (GET /api/workers/ranking, useSuspenseQuery)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき WorkerRankingItem[] が data として解決される（data は undefined を取らない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { workers: [mockWorkerRankingItem] })),
    );
    const { wrapper } = createSuspenseWrapper();
    const { result } = renderHook(() => useWorkerRanking(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([mockWorkerRankingItem]));
  });

  it("エラー応答のとき throw されて ErrorBoundary に捕捉される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Server Error" })));
    const { wrapper, errors } = createSuspenseWrapper();
    renderHook(() => useWorkerRanking(), { wrapper });

    await waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0]).toBeInstanceOf(Error);
  });

  it("正しいエンドポイント GET /api/workers/ranking が呼ばれる", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { workers: [mockWorkerRankingItem] }));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper } = createSuspenseWrapper();
    const { result } = renderHook(() => useWorkerRanking(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/workers/ranking");
    expect(request.method).toBe("GET");
  });

  it("WORKER_RANKING_QUERY_KEY が queryKey として使われる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { workers: [mockWorkerRankingItem] })),
    );
    const { queryClient, wrapper } = createSuspenseWrapper();
    const { result } = renderHook(() => useWorkerRanking(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    const cached = queryClient.getQueryData(WORKER_RANKING_QUERY_KEY);
    expect(cached).toEqual([mockWorkerRankingItem]);
  });
});

describe("useUploadWorkerImage (POST /api/admin/workers/{id}/image, useMutation)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("multipart/form-data で POST し { id, imageUrl } を返す", async () => {
    const mockResponse = { id: "worker-haru", imageUrl: "https://example.com/image.png" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, mockResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUploadWorkerImage(), { wrapper });

    const file = new File(["dummy content"], "avatar.png", { type: "image/png" });
    let mutationResult: { id: string; imageUrl: string } | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({ workerId: "worker-haru", file });
    });

    expect(mutationResult).toEqual(mockResponse);
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

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUploadWorkerImage(), { wrapper });

    const file = new File(["dummy content"], "avatar.png", { type: "image/png" });
    await expect(
      act(async () => {
        await result.current.mutateAsync({ workerId: "worker-haru", file });
      }),
    ).rejects.toThrow("File too large");
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
