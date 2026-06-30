// @vitest-environment jsdom
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_ME_QUERY_KEY } from "./auth.js";
import { useInfiniteCommunityFeed, useInfiniteHomeFeed } from "./feed.js";

const GUEST_ID_KEY = "hatchery:guestId";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
function jsonResponse({ status, body }: { status: number; body?: unknown }): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockFeedResponse = { posts: [], nextCursor: null };

function createWrapper({ authUser }: { authUser: { id: string } | null }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(AUTH_ME_QUERY_KEY, authUser);
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>{children}</Suspense>
      </QueryClientProvider>
    ),
  };
}

/** Node.js 26 の実験的 localStorage は --localstorage-file 未指定で undefined になるため
 * テスト用のインメモリ実装で置き換える。jsdom の Storage API と同等の動作をする。 */
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    // eslint-disable-next-line max-params
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe("useInfiniteCommunityFeed — sessionId 注入テスト (#945)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const localStorageMock = createLocalStorageMock();

  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockFeedResponse }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未認証時に guestId（localStorage 由来）が sessionId として URL に含まれる", async () => {
    const guestId = "guest-uuid-community-123";
    localStorage.setItem(GUEST_ID_KEY, guestId);

    const { wrapper } = createWrapper({ authUser: null });
    renderHook(() => useInfiniteCommunityFeed("test-community"), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).searchParams.get("sessionId")).toBe(guestId);
  });

  it("認証済み時に userId が sessionId として URL に含まれる", async () => {
    const userId = "user-auth-community-456";
    const { wrapper } = createWrapper({ authUser: { id: userId } });
    renderHook(() => useInfiniteCommunityFeed("test-community"), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).searchParams.get("sessionId")).toBe(userId);
  });
});

describe("useInfiniteHomeFeed — sessionId 注入テスト (#945)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const localStorageMock = createLocalStorageMock();

  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 200, body: mockFeedResponse }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未認証時に guestId が sessionId として URL に含まれる", async () => {
    const guestId = "guest-uuid-home-789";
    localStorage.setItem(GUEST_ID_KEY, guestId);

    const { wrapper } = createWrapper({ authUser: null });
    renderHook(() => useInfiniteHomeFeed(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).searchParams.get("sessionId")).toBe(guestId);
  });

  it("認証済み時に userId が sessionId として URL に含まれる", async () => {
    const userId = "user-home-abc";
    const { wrapper } = createWrapper({ authUser: { id: userId } });
    renderHook(() => useInfiniteHomeFeed(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).searchParams.get("sessionId")).toBe(userId);
  });
});
